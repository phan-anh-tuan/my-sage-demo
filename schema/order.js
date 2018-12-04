import joi from 'joi';

const OrderItem = joi.object().keys({
  itemId: joi.string().required().error(() => 'ItemId:Item Id is required'),
  name: joi.string().required().error(() => 'name:Item name is required'),
  quantity: joi.number().required().error(() => 'quantity:Item quantity is required'),
  price: joi.number().required().error(() => 'price:Item price is required')
});

export default joi.object().keys({
  customerId: joi.string().required().error(() => 'customerId:Customer Id is required'),
  orderId: joi.string().required().error(() => 'orderId:Order Id is required'),
  items: joi.array().items(OrderItem).required().error(() => 'items:Order items are required'),
  version: joi.number().required().error(() => 'version:Order version is required')
});
