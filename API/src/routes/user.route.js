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
  getUserRoleById,
  getAllUserRoles,
} = require('../controllers/user.controller');
const {
  AdminAndCompanyAndNormal,
  AdminAndCompany,
  Admin,
  AdminAndCompanyAndDistributor
} = require('../utils/allowed-roles.util');
console.log(...AdminAndCompany);
const router = express.Router();

router.get('/users', getUsers);
router.get('/users/data', authMiddleware(...AdminAndCompanyAndNormal), getUserInfo);
router.get('/users/data/:id', authMiddleware(...AdminAndCompanyAndNormal), getUserInfoById);
router.post('/users/register',  authMiddleware(...AdminAndCompanyAndDistributor), validateParams(registerParams, true), registerUser);
router.post('/users/login', validateParams(loginParams), loginUser);
router.get('/users/role/:id', authMiddleware(...AdminAndCompanyAndNormal), getUserRoleById);
router.get('/users/roles', authMiddleware(...AdminAndCompany), getAllUserRoles);

module.exports = router;