import { success, failure } from './lib/response';
import { call } from './lib/dynamodb';

function buildRequestParameter(orderDetails) {
  return Object.assign({}, { TableName: process.env.ORDERS_TABLE }, { Key : orderDetails }, { ReturnValues: 'ALL_OLD' } );
}

export async function main(event, context) {
  // Request body is passed in as a JSON encoded string in 'event.body'
  const data = JSON.parse(event.body);
  
  const orderDetail = {
    orderId: data.orderId,
    version: data.version, // this should be datetime ??
  };

  const params = buildRequestParameter(orderDetail);
  console.log('DynamoDB called with: ',params)
  try {
    const order = await call('delete', params);
    return data.isCompensationTransaction ? 
        failure(Object.assign({}, { failureCause: data.failureCause }, { success: false }))
        :
        success(Object.assign({}, { item: order.Attributes }, { success: true }))
  } catch (e) {
    // retry behaviour is handled by aws sdk so we don't have to worry about it.
    console.log('dynamodb delete error: ',e);
  }
}