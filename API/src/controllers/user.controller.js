const db = require('../../models');
const ErrorHandler = require('../utils/error.util');
const { userNotFound, passwordsDontMatch } = require('../utils/errorcodes.util');
const User = db.user;

const getUsers = async (req, res, next) => {
  try {
    const users = await User.findAll()
    res.json(users)
  } catch (error) {
    next(error)
  }
}

const registerUser = async (req, res, next) => {
  try {
    const user = await User.create(req.body)
    const token = await user.generateToken()
    res.json({user, token})
  } catch (error) {
    next(error)
  }
}

const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ where: { email } })
    if (!user) {
      throw new ErrorHandler(userNotFound)
    }
    const isValid = await user.checkPassword(password)
    if (!isValid) {
      throw new ErrorHandler(passwordsDontMatch)
    }
    const token = await user.generateToken()
    res.status(201).json({ user, token })
  }
  catch (error) {
    next(error)
  }
}

module.exports = {
  getUsers,
  registerUser,
  loginUser,
}

