const express = require('express');
const validateParams = require('../middlewares/validate-params.middleware');
const authMiddleware = require('../middlewares/auth.middleware');
const { loginParams, registerParams } = require('../utils/params/user/user.params');
const { 
  getUsers,
  getUserInfo,
  getUserInfoById,
  registerUser,
  loginUser,
} = require('../controllers/user.controller');
const {
  AllRoles,
  AdminAndCompany,
  Admin
} = require('../utils/allowed-roles.util');
console.log(...AdminAndCompany);
const router = express.Router();

router.get('/users', getUsers);
router.get('/users/data', authMiddleware(...AllRoles), getUserInfo);
router.get('/users/data/:id', authMiddleware(...AllRoles), getUserInfoById);
router.post('/users/register',  authMiddleware(...AdminAndCompany), validateParams(registerParams), registerUser);
router.post('/users/login', validateParams(loginParams), loginUser);

module.exports = router;