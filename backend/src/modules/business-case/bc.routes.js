const express = require('express');
const router = express.Router();
const bcController = require('./bc.controller');
const { verifyToken } = require('../../middlewares/authMiddleware');

router.use(verifyToken);

// Endpoint para cálculo en tiempo real
router.post('/calculate', bcController.calculate);

module.exports = router;
