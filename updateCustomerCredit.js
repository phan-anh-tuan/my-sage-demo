import { success } from './lib/response';
import { call } from './lib/dynamodb';
import UnrecoverableException from './exception/UnrecoverableException';
import DuplicatedRequestException from './exception/DuplicatedRequestException';
import NotEnoughCreditException from './exception/NotEnoughCreditException';
import async from 'async';

function buildUpdateCustomerCreditRequests(order) {
    const { items, orderId, version, customerId } = order;
    const cost = items.reduce((accumulator, item) => accumulator + item.quantity * item.price, 0);
    // cannot use BatchWriteItem here due to some restrictions documented at #https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#batchWriteItem-property
    // BatchWriteItem does not behave in the same way as individual PutItem and DeleteItem calls would.
    // For example, you cannot specify conditions on individual put and delete requests, and BatchWriteItem does not return deleted items in the response.
    
    return [
        function(cb) {
            // TODO: replace sequential calls with transactWriteItems when it is available on aws-sdk for nodejs
            // see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItem.html
            // Alternatively you can implement a dynamodb-based-trigger lamdba to update customer credit everytime new record is inserted into transaction-history table.
            // The question is what will happen if Lamdba service is down at the time or if customer has not enough credit (should we create a sqs to handle offline rollback ??)
            async.series({
            validation: function(callback) {
                const params = Object.assign({},
                    { TableName: process.env.TRANSACTION_HISTORY_TABLE },
                    { 
                        Item: { 
                            customerId: customerId,
                            transactionId: orderId.concat("#").concat(version),
                            value: cost,
                            type: 'debit',
                            status: 'unconfirmed',
                            lastUpdated: Date.now() //to unconfirmed item which is 1+ day old, is it safe to assume that it was processed unsuccessfully ?
                        }
                    },
                    {  ConditionExpression: 'attribute_not_exists(customerId) AND attribute_not_exists(transactionId)' });
                
                console.log('validation params ', params)
                call('put',params)
                    .then(result => callback(null, result))
                    .catch(error => {
                        if (error.code === 'ConditionalCheckFailedException') {
                            return callback(new DuplicatedRequestException())
                        } else {
                            return callback(new UnrecoverableException())
                        }
                    })
            },
            update: function(callback) {
                const params = Object.assign({},
                { TableName: process.env.CUSTOMER_TABLE },
                { Key: { customerId: customerId }},
                { UpdateExpression: 'ADD credit :removedValue' } ,
                { ExpressionAttributeValues: { ':removedValue': -1 * cost, ':cost': cost }},
                { ConditionExpression: ' credit > :cost' } );
                
                console.log('update params ', params)
                call('update',params)
                    .then(result => callback(null, result))
                    .catch(error => {
                        if (error.code === 'ConditionalCheckFailedException') {
                            return callback(new NotEnoughCreditException())
                        } else {
                            return callback(new UnrecoverableException())
                        }
                    })
            },
            confirm: function(callback) {
                const params = Object.assign({},
                { TableName: process.env.TRANSACTION_HISTORY_TABLE },
                { Key: { customerId: customerId, transactionId: orderId.concat("#").concat(version), }},
                { UpdateExpression: 'SET #status = :confirmed' } ,
                { ExpressionAttributeValues: { ':confirmed': 'confirmed' }},
                { ExpressionAttributeNames: { '#status': 'status' }},
                { ConditionExpression: 'attribute_exists(customerId) AND attribute_exists(transactionId)' } );
                
                console.log('confirm params ', params)
                call('update',params)
                    .then(result => callback(null, result))
                    .catch(error => callback(error))
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
    ]
}

function PromisifyAsync(tasks) {
  return new Promise(function(resolve,reject){
    // use reflectAll to catch all errors otherwise async will stop task execution as the first error happen
    // assuming that each tasks will handle retryable errors
    async.parallel(async.reflectAll(tasks), (e, results) => {
        let error;
      const isError = results.some((result) => {
          if (result.error) {
            error = result.error;
            return true;
          }});
      if (isError) {
        return reject(error);
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
  
  const tasks = buildUpdateCustomerCreditRequests(data);
  try {
    return await PromisifyAsync(tasks);
  } catch(error) {
    // Exception Handling varies depend on event source
    // In case event source is step function (how to identify event source?), throw an exception so that step functions can deal with it
    // In case event source is API Gateway then  ????
    console.log('Error updating customer credit ',error)
    throw error;
  }
}