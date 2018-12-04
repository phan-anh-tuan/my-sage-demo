export default class UnrecoverableException extends Error {
    constructor(message) {
      super(message);
      this.name = "UnrecoverableException";
    }
  }