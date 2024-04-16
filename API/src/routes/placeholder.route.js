const express = require('express');
const { 
  placeholderController
} = require('../controllers/placeholder.controller');

const router = express.Router();

router.get('/placeholder', placeholderController);

module.exports = router;