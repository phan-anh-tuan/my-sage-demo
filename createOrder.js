import validate from './lib/validation';
import { success, failure } from './lib/response';
import { call } from './lib/dynamodb';
import InvalidParrameterError from './exception/InvalidParrameterException';
import DuplicatedRequestException from './exception/DuplicatedRequestException';

function buildRequestParameter(orderDetails) {
  return Object.assign({}, { TableName: process.env.ORDERS_TABLE }, { Item : orderDetails} , {  ConditionExpression: 'attribute_not_exists(orderId) AND attribute_not_exists(version)' } );
  // return Object.assign({}, { TableName: process.env.ORDERS_TABLE }, Item);
}

export async function main(event, context) {
  // Request body is passed in as a JSON encoded string in 'event.body'
  const data = JSON.parse(event.body);
  
  const orderDetail = {
    orderId: data.orderId,
    items: data.items,
    version: data.version,
  };
  // validate input
  const { errors, value } = validate(orderDetail, 'order');
  if (errors) {
    // Throw an exception that step functions can catch then deal with it
    throw new InvalidParrameterError('Invalid Order Details'.concat(errors.toString()));
    return;
  }
  const params = buildRequestParameter(value);
  console.log('DynamoDB called with: ',params)
  try {
    await call('put', params);
    return success(Object.assign({}, { item: params.Item }, { success: true }));
  } catch (e) {
    // retry behaviour is handled by aws sdk so we don't have to worry about it.
    if (e.code === 'ConditionalCheckFailedException') {
      throw new DuplicatedRequestException('Duplicated Order '.concat(data.orderId))
    } else {
      console.log('dynamodb put error: ',e);
      throw e;  
    }
  }
}


  