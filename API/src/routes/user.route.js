const express = require('express');
const validateParams = require('../middlewares/validate-params.middleware');
const authMiddleware = require('../middlewares/auth.middleware');
const { loginParams, registerParams } = require('../utils/params/user/user.params');
const { 
  getUsers,
  getUserInfo,
  registerUser,
  loginUser,
} = require('../controllers/user.controller');

const router = express.Router();

router.get('/users/register', getUsers);
router.get('/users/info', authMiddleware('normal', 'admin'), getUserInfo);
router.post('/users/register',  validateParams(registerParams), registerUser);
router.post('/users/login', validateParams(loginParams), loginUser);

module.exports = router;