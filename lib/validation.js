import joi from 'joi';
import order from '../schema/order';

function parseError(error) {
  let errors = null;
  if (error) {
    errors = {};
    const regex = /\[(.*?)\]/g;
    error.message.replace(regex, (match, msg) => {
      const [key, val] = msg.split(':');
      errors[key] = val;
    });
  }
  return errors;
}

const schemas = {
  order,
};

export default function validate(input, schema) {
  const { error, value } = joi.validate(input, schemas[schema], { abortEarly: false });
  const errors = parseError(error);
  return { errors, value };
}

