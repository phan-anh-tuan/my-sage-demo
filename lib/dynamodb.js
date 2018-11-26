import AWS from 'aws-sdk';

AWS.config.update({ region: 'ap-southeast-2' });
const IS_OFFLINE = process.env.IS_OFFLINE;

let dynamoDb;
if (IS_OFFLINE === 'true') {
  dynamoDb = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
  });
} else {
  dynamoDb = new AWS.DynamoDB.DocumentClient();
}

export function call(action, params) {
  return dynamoDb[action](params).promise();
}