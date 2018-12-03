import { success } from './lib/response';
import { call } from './lib/dynamodb';
import IdempotentVerificationException from './exception/IdempotentVerificationException';
import DuplicatedRequestException from './exception/DuplicatedRequestException';
import async from 'async';

function buildValidateCompensationRequestParameter(order) {
    const { orderId, version } = order;
    return Object.assign({}, { TableName: process.env.PROCESSED_ORDER_TABLE }, { Key : { 'orderId': orderId, 'version': version }} , {  ConditionExpression: 'attribute_exists(orderId) AND attribute_exists(version)' } );
}

function buildCompensatingUpdateInventoryRequests(orderItems) {
    // For simplicity, make it consistent with updateInventory counterpart i.e not using BatchWriteItem here
    return orderItems.map(function(item){
        const params = Object.assign({},
        { TableName: process.env.INVENTORY_TABLE },
        { Key: { itemId: item.itemId }},
        { UpdateExpression: 'ADD quantity :quantity' } ,
        { ExpressionAttributeValues: { ':quantity': item.quantity }});
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
    return new Promise(function(resolve, reject){
        // use reflectAll to catch all errors otherwise async will stop task execution as the first error happen
        // assuming that each tasks will handle retriable errors
        async.parallel(async.reflectAll(tasks), (error, results) => {
        results.map(function(result,idx){
            if (result.error) {
            failedItems.push(items[idx])
            }
        })
        if (failedItems.length > 0) {
            reject(new Error('failed to rollback items ', failedItems.join(";")));
        } 
        resolve(success(Object.assign({}, { success: true })));
        });
    })
}
export async function main(event, context) {
  // Request body is passed in as a JSON encoded string in 'event.body'
    console.log('Function arguments ', event);
  
    const orderDetail = typeof event.body === "string" ? JSON.parse(event.body) : event.body;

    const updateInventoryErrorInfo = typeof orderDetail['update-inventory-error-info'] === "string" ? 
        JSON.parse(orderDetail['update-inventory-error-info']) 
    :   orderDetail['update-inventory-error-info'];
    
    let params;
  
    // for simplicity purpose we will skip input validation here
    // instead assuming that event['update-inventory-error-info'] contain valid data
    try {
        // check if the compensation action was processed earlier
        params = buildValidateCompensationRequestParameter(orderDetail);
        const order = await call('get', params);
    } catch (e) {
        if (e.code === 'ConditionalCheckFailedException') {
            throw new DuplicatedRequestException('Duplicated UpdateInventory Compensation Activity for order '.concat(data.orderId))
        } else {
            console.log('UpdateInventory Compensation Activity: ',e);
            throw new IdempotentVerificationException('orderId: '.concat(orderId.orderId)); 
        }
    }

    const { items } = orderDetail;
    const rollbackItems = JSON.parse(updateInventoryErrorInfo.Cause).errorMessage.split(";");
    const tasks = buildCompensatingUpdateInventoryRequests(items.filter(item => !rollbackItems.includes(item.itemId)));
   
    try {
        await PromisifyAsync(tasks, items);
        // remove the order
        const order = await call('delete', params);
    } catch (e) {
        // Notify management to take actions to keep the inventory integrity
        // then continue rolling back process i.e can't propagate error
        console.log('Failed to compensate UpdateInventory ', e);
    }
    return success(Object.assign({}, { success: true }))

}