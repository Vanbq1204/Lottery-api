const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../controllers/authController');
const { getLotoMultiplier, updateLotoMultiplier } = require('../controllers/lotoMultiplierController');

// Routes cho hệ số lô
router.get('/loto-multiplier', authenticateToken, requireRole(['employee']), getLotoMultiplier);
router.put('/loto-multiplier', authenticateToken, requireRole(['employee']), updateLotoMultiplier);

module.exports = router; 