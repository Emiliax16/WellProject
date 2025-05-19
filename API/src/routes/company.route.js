const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const { 
    getAllCompanies, 
    getCompanyInfo,
    getAllCompanyClients,
    addClientToCompany,
    removeClientFromCompany,
    deleteCompany,
    editCompany
} = require('../controllers/company.controller');
const {
  AdminAndCompany,
  Admin,
  AdminAndCompanyAndDistributor
} = require('../utils/allowed-roles.util');
const router = express.Router();

router.get('/companies', authMiddleware(...AdminAndCompanyAndDistributor), getAllCompanies);
router.get('/companies/:id', authMiddleware(...AdminAndCompanyAndDistributor), getCompanyInfo);
router.get('/companies/:id/clients', authMiddleware(...AdminAndCompany), getAllCompanyClients);
router.post('/companies/:id/clients/:clientId', authMiddleware(...AdminAndCompany), addClientToCompany);
router.delete('/companies/:id/clients/:clientId', authMiddleware(...AdminAndCompany), removeClientFromCompany);
router.delete('/companies/:id/delete', authMiddleware(...Admin), deleteCompany);
router.put('/companies/:id/edit', authMiddleware(...AdminAndCompanyAndDistributor), editCompany);

module.exports = router;
