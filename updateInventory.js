import validate from './lib/validation';
import { success, failure } from './lib/response';
import { call } from './lib/dynamodb';
import IdempotentVerificationException from './exception/IdempotentVerificationException';
import DuplicatedRequestException from './exception/DuplicatedRequestException';
import ItemOutOfStockException from './exception/ItemOutOfStockException';
import async from 'async';

function buildValidateOrderRequestParameter(order) {
  const { orderId, version } = order;
  // return Object.assign({}, { TableName: process.env.PROCESSED_ORDER_TABLE }, { Key : { 'orderId': orderId, 'version': version } });
  return Object.assign({}, { TableName: process.env.PROCESSED_ORDER_TABLE }, { Item : { 'orderId': orderId, 'version': version }} , {  ConditionExpression: 'attribute_not_exists(orderId) AND attribute_not_exists(version)' } );
}

function buildUpdateInventoryRequests(orderItems) {
  // cannot use BatchWriteItem here due to some restrictions documented at #https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#batchWriteItem-property
  // BatchWriteItem does not behave in the same way as individual PutItem and DeleteItem calls would.
  // For example, you cannot specify conditions on individual put and delete requests, and BatchWriteItem does not return deleted items in the response.
  return orderItems.map(function(item){
    const params = Object.assign({},
      { TableName: process.env.INVENTORY_TABLE },
      { Key: { itemId: item.itemId }},
      { UpdateExpression: 'ADD quantity :removedQuantity' } ,
      { ExpressionAttributeValues: { ':removedQuantity': -1 * item.quantity, ':quantity': item.quantity }},
      { ConditionExpression: ' quantity > :quantity' } );
    console.log('Updating inventory: ',params)
    
    return function(cb) {
      call('update',params)
        .then(result => {return cb(null, result)})
        .catch(error => {
          // retry behaviour is handled by aws sdk so we don't have to worry about it.
          return cb(error);
        });
    }
  })  
}

function PromisifyAsync(tasks, items) {
  const failedItems = [];
  return new Promise(function(resolve,reject){
    // use reflectAll to catch all errors otherwise async will stop task execution as the first error happen
    // assuming that each tasks will handle retryable errors
    async.parallel(async.reflectAll(tasks), (error, results) => {
      results.map(function(result,idx){
        if (result.error) {
          failedItems.push(items[idx].itemId)
        }
      })
      
      if (failedItems.length > 0) {
        console.log('updating inventory failedItems ', failedItems);
        reject(new ItemOutOfStockException(failedItems.join(";")));
      } else {
        console.log('updating inventory resolving the promise');
        resolve(success(Object.assign({}, { success: true })));
      }
    });
  })
}
export async function main(event, context) {
  // Request body is passed in as a JSON encoded string in 'event.body'
  console.log('Function arguments ', event);
  let data = event.body;
  if (typeof event.body === "string") {
    data = JSON.parse(event.body);
  }
  let params;
  
  // for simplicity purpose we will skip input validation here
  // instead relying on createOrder to do that.

  try {
    // check if the order was processed earlier
    params = buildValidateOrderRequestParameter(data);
    const order = await call('put', params);
  } catch (e) {
    if (e.code === 'ConditionalCheckFailedException') {
      throw new DuplicatedRequestException('Duplicated Order '.concat(data.orderId))
    } else {
      console.log('Order validation error: ',e);
      throw new IdempotentVerificationException('orderId: '.concat(orderId.orderId)); 
    }
  }

  const { items } = data;
  const tasks = buildUpdateInventoryRequests(items);
  
  try {
    return await PromisifyAsync(tasks, items);
  } catch(error) {
    // Exception Handling varies depend on event source
    // In case event source is step function (how to identify event source?), throw an exception so that step functions can deal with it
    // In case event source is API Gateway then  ????
    console.log('Error updating inventtory ',error)
    throw error;
  }
  /*
  async.parallel(async.reflectAll(tasks), (error, results) => {
    results.map(function(result,idx){
      if (result.error) {
        failedItems.push(items[idx])
      }
    })
    if (failedItems.length > 0) {
      // retry behaviour is handled by aws sdk so we don't have to worry about it.
      // Exception Handling varies depend on event source
      // In case event source is step function (how to identify event source?), throw an exception so that step functions can deal with it
      throw new ItemOutOfStockException(failedItems.join(";"));
    } else {
      return success(Object.assign({}, { success: true }));
    }
  });*/
}