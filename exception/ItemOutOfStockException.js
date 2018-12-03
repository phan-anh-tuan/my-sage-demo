export default class ItemOutOfStockException extends Error {
    constructor(message) {
      super(message);
      this.name = "ItemOutOfStockException";
    }
  }
  