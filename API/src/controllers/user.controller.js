const db = require('../../models');
const ErrorHandler = require('../utils/error.util');
const { userNotFound, passwordsDontMatch, unauthorized } = require('../utils/errorcodes.util');
const User = db.user;
const Client = db.client;
const Person = db.person;

//           GET USER DATA

const getUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: {
        exclude: ['encrypted_password']
      }
    })
    res.json(users)
  } catch (error) {
    next(error)
  }
}

const getUserInfo = async (req, res, next) => {
  try {
    const { id } = req.user
    const user = await User.findByPk(id, { attributes: { exclude: ['encrypted_password'] }})
    res.json(user)
  } catch (error) {
    next(error)
  }
}

const getUserInfoById = async (req, res, next) => {
  try {
    // si los id no son iguales, solo se puede proceder si el rol del usuario es admin
    const { id: clientId } = req.params
    const { id: requesterId, type: requesterRole} = req.user

    const client = await Client.findByPk(clientId);
    const userId = client.userId;

    if (userId !== requesterId && requesterRole !== 'admin') {
      throw new ErrorHandler(unauthorized)
    }
    console.log(userId, requesterId, requesterRole)
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['encrypted_password'] },  
      include: {
        model: Person,
        as: 'person',
        attributes: {
          exclude: ['userId']
        }
      }

    });
    res.json(user)
  } catch (error) {
    next(error)
  }
}

//                USER WELLS

//                USER AUTH

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

    delete user.dataValues.encrypted_password
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

    delete user.dataValues.encrypted_password
    const token = await user.generateToken()
    res.status(201).json({ user, token })
  }
  catch (error) {
    next(error)
  }
}

module.exports = {
  getUsers,
  getUserInfo,
  getUserInfoById,
  registerUser,
  loginUser,
}

