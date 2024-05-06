const ErrorHandler  = require('../utils/error.util');
const { trol } = require('../utils/errorcodes.util');

const checkTroll = (trolWord = 'hi') => {
  return (req, res, next) => {
    try {
      if (req.body.email === trolWord || req.body.personalEmail === trolWord) {
        throw new ErrorHandler(trol);
      }
      next();
    } catch (error) {
      next(error);
    }
  }
}

module.exports = checkTroll;