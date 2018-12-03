export default class IdempotentVerificationException extends Error {
  constructor(message) {
    super(message);
    this.name = "IdempotentVerificationException";
  }
}