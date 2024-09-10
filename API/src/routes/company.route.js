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
const router = express.Router();

router.get('/companies', authMiddleware('admin'), getAllCompanies);
router.get('/companies/:id', authMiddleware('admin', 'company'), getCompanyInfo);
router.get('/companies/:id/clients', authMiddleware('admin', 'company'), getAllCompanyClients);
router.post('/companies/:id/clients/:clientId', authMiddleware('admin', 'company'), addClientToCompany);
router.delete('/companies/:id/clients/:clientId', authMiddleware('admin', 'company'), removeClientFromCompany);
router.delete('/companies/:id/delete', authMiddleware('admin'), deleteCompany);
router.put('/companies/:id/edit', authMiddleware('admin'), editCompany);

module.exports = router;