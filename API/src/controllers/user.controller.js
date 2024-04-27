const db = require('../../models');
const ErrorHandler = require('../utils/error.util');
const { userNotFound, passwordsDontMatch } = require('../utils/errorcodes.util');
const User = db.user;
const Person = db.person;

const getUsers = async (req, res, next) => {
  try {
    const users = await User.findAll()
    res.json(users)
  } catch (error) {
    next(error)
  }
}

const getUserInfo = async (req, res, next) => {
  try {
    const { id } = req.user
    const user = await User.findByPk(id, { exclude: ['encrypted_password']})
    res.json(user)
  } catch (error) {
    next(error)
  }
}


const registerUser = async (req, res, next) => {
  try {
    // Separar atributos del body que son de User y Person
    userParams = {
      name: req.body.name,
      email: req.body.email,
      encrypted_password: req.body.encrypted_password,
      roleId: req.body.roleId,
      isActived: req.body.isActived
    }

    personParams = {
      fullName: req.body.fullName,
      location: req.body.location,
      phoneNumber: req.body.phoneNumber,
      personalEmail: req.body.personalEmail,
      userId: null
    }

    const user = await User.create(userParams)
    user.createPerson(personParams, Person)
    
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
  getUserInfo,
  loginUser,
}

