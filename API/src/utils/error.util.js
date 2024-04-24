class ErrorHandler extends Error {
  constructor(errorType) {
    super(errorType.message);
    this.statusCode = errorType.code;
  }
}
module.exports = ErrorHandler;

