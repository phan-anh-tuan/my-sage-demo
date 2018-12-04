import { success } from './lib/response';
import { call } from './lib/dynamodb';
import UnrecoverableException from './exception/UnrecoverableException';
import DuplicatedRequestException from './exception/DuplicatedRequestException';
import ValidationException from './exception/ValidationException';
import async from 'async';

function buildUpdateInventoryRequests(order) {
  const { items, orderId, version } = order;
  // cannot use BatchWriteItem here due to some restrictions documented at #https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#batchWriteItem-property
  // BatchWriteItem does not behave in the same way as individual PutItem and DeleteItem calls would.
  // For example, you cannot specify conditions on individual put and delete requests, and BatchWriteItem does not return deleted items in the response.
  return items.map(function(item){
    return function(cb) {
      // TODO: replace sequential calls with transactWriteItems when it is available on aws-sdk for nodejs
      // see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItem.html
      async.series({
        validation: function(callback) {
          const params = Object.assign({},
            { TableName: process.env.PROCESSED_ORDER_TABLE },
            { 
              Item: { 
                orderId: orderId.concat("#").concat(version),
                itemId: item.itemId,
                quantity: item.quantity,
                status: 'unconfirmed',
                lastUpdated: Date.now() //to unconfirmed item which is 1+ day old, is it safe to assume that it was processed unsuccessfully ?
              }
            },
            {  ConditionExpression: 'attribute_not_exists(orderId) AND attribute_not_exists(itemId)' }
          );
          console.log('validation params ', params)
          call('put',params)
            .then(result => callback(null, result))
            .catch(error => {
              if (error.code === 'ConditionalCheckFailedException') {
                return callback(new DuplicatedRequestException())
              } else {
                return callback(new ValidationException())
              }
            })
        },
        update: function(callback) {
          const params = Object.assign({},
            { TableName: process.env.INVENTORY_TABLE },
            { Key: { itemId: item.itemId }},
            { UpdateExpression: 'ADD quantity :removedQuantity' } ,
            { ExpressionAttributeValues: { ':removedQuantity': -1 * item.quantity, ':quantity': item.quantity }},
            { ConditionExpression: ' quantity > :quantity' } );
          
          console.log('update params ', params)
          call('update',params)
            .then(result => callback(null, result))
            .catch(error => callback(error))
        },
        confirm: function(callback) {
          const params = Object.assign({},
            { TableName: process.env.PROCESSED_ORDER_TABLE },
            { Key: { orderId: orderId.concat("#").concat(version), itemId: item.itemId }},
            { UpdateExpression: 'SET #status = :confirmed' } ,
            { ExpressionAttributeValues: { ':confirmed': 'confirmed' }},
            { ExpressionAttributeNames: { '#status': 'status' }},
            { ConditionExpression: 'attribute_exists(orderId) AND attribute_exists(itemId)' } );
          
          console.log('confirm params ', params)
          call('update',params)
            .then(result => callback(null, result))
            .catch(error => {
              console.log('confirming exception ', error)
              return callback(error);
            })
        }
      },function(error){
          if (error) {
            if (error.name === "DuplicatedRequestException") {
              return cb(null, {})
            } else {
              return cb(error);
            }
          }
          return cb(null, {})
      });
    }
  })  
}

function PromisifyAsync(tasks) {
  return new Promise(function(resolve,reject){
    // use reflectAll to catch all errors otherwise async will stop task execution as the first error happen
    // assuming that each tasks will handle retryable errors
    async.parallel(async.reflectAll(tasks), (error, results) => {
      const isError = results.some((result) => { if (result.error) return true });
      if (isError) {
        return reject(new UnrecoverableException());
      } else {
        return resolve(success(Object.assign({}, { success: true })));
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
  
  const tasks = buildUpdateInventoryRequests(data);
  try {
    return await PromisifyAsync(tasks);
  } catch(error) {
    // Exception Handling varies depend on event source
    // In case event source is step function (how to identify event source?), throw an exception so that step functions can deal with it
    // In case event source is API Gateway then  ????
    console.log('Error updating inventory ',error)
    throw new UnrecoverableException();
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