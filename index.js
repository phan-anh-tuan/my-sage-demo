import serverless from 'serverless-http';
import bodyParser from 'body-parser';
import express from 'express';
import AWS from 'aws-sdk';
import { main as createOrderHandler } from './createOrder';

const app = express();
app.use(bodyParser.json({ strict: false }));

app.post('/orders', createOrderHandler);

app.get('/', function(req,res){
    res.send('Hello World');
});

module.exports.handler = serverless(app);