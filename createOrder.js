import validate from './lib/validation';
import { success, failure } from './lib/response';
import { call } from './lib/dynamodb';
import InvalidParrameterError from './exception/InvalidParrameterException';
import DuplicatedRequestException from './exception/DuplicatedRequestException';

function buildRequestParameter(orderDetails) {
  return Object.assign({}, { TableName: process.env.ORDERS_TABLE }, { Item : orderDetails} , {  ConditionExpression: 'attribute_not_exists(orderId) AND attribute_not_exists(version)' } );
}

export async function main(event, context) {
  // Request body is passed in as a JSON encoded string in 'event.body'
  console.log('Function arguments ', event);
  let data = event.body;
  if (typeof event.body === "string") {
    data = JSON.parse(event.body);
  } 

  const orderDetail = {
    orderId: data.orderId,
    items: data.items,
    version: data.version, // this should be datetime ??
  };
  // validate input
  const { errors, value } = validate(orderDetail, 'order');
  if (errors) {
    // Exception Handling varies depend on event source
    // In case event source is step function (how to identify event source?), throw an exception so that step functions can deal with it
    throw new InvalidParrameterError('Invalid Order Details'.concat(errors.toString()));
  }
  
  const params = buildRequestParameter(value);
  console.log('DynamoDB called with: ',params)
  try {
    await call('put', params);
    // unmark the line below to test rollback scenario
    // if (data.isError) throw new Error('To test rollback behavior');
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