import { success } from './lib/response';
import { call } from './lib/dynamodb';
import UnrecoverableException from './exception/UnrecoverableException';
import async from 'async';

function buildCompensatingUpdateInventoryRequests(order) {
    const { orderId, version } = order;
    return new Promise(function(resolve, reject){
      const params = Object.assign({},
        { TableName: process.env.PROCESSED_ORDER_TABLE },
        { 
          FilterExpression: 'orderId = :orderId',
        },
        { ExpressionAttributeValues: { ':orderId': orderId.concat('#').concat(version) }}
      );
      console.log('query params ', params)
      call('scan',params)
        .then(rollbackList => {
          resolve(
            rollbackList.Items.map(function(item){
              return function(cb) {
                // TODO: replace sequential calls with transactWriteItems when it is available on aws-sdk for nodejs
                // see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItem.html
                async.series({
                  rollback: function(callback){
                    if (item.status === 'unconfirmed') return setImmediate(() => callback(null));
                    
                    const params = Object.assign({},
                      { TableName: process.env.INVENTORY_TABLE },
                      { Key: { itemId: item.itemId }},
                      { UpdateExpression: 'ADD quantity :quantity' } ,
                      { ExpressionAttributeValues: { ':quantity': item.quantity }});
                    
                    console.log('rollback inventory update: ',params)

                    call('update',params)
                      .then(result => { return callback(null, result) })
                      .catch(error => {
                        // should push a message to SNS/SQS to notify management
                        // AND allow manual rollback process.
                        return callback(error);
                      });
                  },
                  delete: function(callback){
                    const params = Object.assign({},
                      { TableName: process.env.PROCESSED_ORDER_TABLE },
                      { Key: { orderId: item.orderId, itemId: item.itemId }});
                    
                    console.log('delete PROCESSED_ORDER_TABLE: ',params)
                    call('delete',params)
                      .then(result => {return callback(null, result)})
                      .catch(error => {
                        return callback(error);
                    });
                  },
                }, function(error, results){
                  if (error) {
                    return cb(error);
                  }
                  return cb(null, {})
                });
              }
            })); 
        })
        .catch(error => { 
          return reject(error);
        })
      });
}

function PromisifyAsync(tasks) {
  return new Promise(function(resolve, reject){
      // use reflectAll to catch all errors otherwise async will stop task execution as the first error happen
      // assuming that each tasks will handle retriable errors
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

  const order = typeof event.body === "string" ? JSON.parse(event.body) : event.body;

  try {
      const tasks = await buildCompensatingUpdateInventoryRequests(order);
      await PromisifyAsync(tasks);
  } catch (e) {
      // should push a message to SNS/SQS to notify management
      // AND allow manual rollback process.
      console.log('Failed to compensate UpdateInventory ', e);
  }
  // return positive response to keep multi-step rollback process running ?
  return success(Object.assign({}, { success: true }))
}