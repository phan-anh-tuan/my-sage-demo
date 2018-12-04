export default class NotEnoughCreditException extends Error {
    constructor(message) {
      super(message);
      this.name = "NotEnoughCreditException";
    }
  }