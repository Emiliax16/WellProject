const express = require('express');
const validateParams = require('../middlewares/validate-params.middleware');
const { loginParams, registerParams } = require('../utils/params/user/user.params');
const { 
  getUsers,
  registerUser,
  loginUser,
} = require('../controllers/user.controller');

const router = express.Router();

router.get('/users/register', getUsers);
router.post('/users/register', validateParams(registerParams), registerUser);
router.post('/users/login', validateParams(loginParams), loginUser);

module.exports = router;