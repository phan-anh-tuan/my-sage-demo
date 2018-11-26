import validate from './lib/validation';
import { success, failure } from './lib/response';
import { call } from './lib/dynamodb';
import InvalidParrameterError from './lib/InvalidParrameterException';

function buildRequestParameter(orderDetail) {
  return orderDetail;
}

export default async function main(event, context) {
  // Request body is passed in as a JSON encoded string in 'event.body'
  const data = JSON.parse(event.body);

  const orderDetail = {
    orderId: data.orderId,
    items: data.items,
    version: Date.now(),
  };

  // validate input
  const { errors, value } = validate(orderDetail, 'order');
  if (errors) {
    // Throw an exception that step functions can catch then deal with it
    throw new InvalidParrameterError('Invalid Order Details'.concat(errors.toString()));
    return;
  }

  const Item = buildRequestParameter(value);
  const params = {
    TableName: process.env.ORDERS_TABLE,
    // 'Item' contains the attributes of the item to be created
    Item,
  };

  try {
    await call('put', params);
    return success(Object.assign({}, { item: params.Item }, { success: true }));
  } catch (e) {
    // retry behaviour is handled by aws sdk so we don't have to worry about it.
    console.log(e);
    throw e;
  }
}


  