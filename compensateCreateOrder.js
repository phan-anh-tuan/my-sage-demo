import { success, failure } from './lib/response';
import { call } from './lib/dynamodb';

function buildRequestParameter(orderDetails) {
  return Object.assign({}, { TableName: process.env.ORDERS_TABLE }, { Key : orderDetails }, {  ConditionExpression: 'attribute_exists(orderId) AND attribute_exists(version)' }, { ReturnValues: 'ALL_OLD' } );
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
    version: data.version, // this should be datetime ??
  };

  const params = buildRequestParameter(orderDetail);
  console.log('DynamoDB called with: ',params)
  try {
    const order = await call('delete', params);
    /*
    return data.isCompensationTransaction ? 
        failure(Object.assign({}, { failureCause: data.failureCause }, { success: false }))
        :
        success(Object.assign({}, { item: order.Attributes }, { success: true })) */
    return success(Object.assign({}, { success: true }));
  } catch (e) {
    // retry behaviour is handled by aws sdk so we don't have to worry about it.
    if (e.code === 'ConditionalCheckFailedException') {
      // the function was called before so all good
      return success(Object.assign({}, { success: true }));
    } else {
      // Notify management to take actions to keep the inventory integrity
      // then continue rolling back process  i.e can't propagate error
      console.log('Error compensating OrderCreation activity: ',e);
      return success(Object.assign({}, { success: true }));
    }
  }
}