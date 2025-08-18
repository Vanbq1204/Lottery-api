const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../controllers/authController');
const {
  calculatePrizesForDate,
  getWinningInvoices,
  togglePaidStatus,
  getPrizeMultipliers,
  updatePrizeMultiplier
} = require('../controllers/prizeController');

// Routes cho tính thưởng
router.post('/calculate', authenticateToken, calculatePrizesForDate);
router.get('/winning-invoices', authenticateToken, getWinningInvoices);
router.put('/winning-invoices/:invoiceId/toggle-paid', authenticateToken, togglePaidStatus);

// Routes cho hệ số thưởng
router.get('/multipliers', authenticateToken, getPrizeMultipliers);
router.put('/multipliers', authenticateToken, updatePrizeMultiplier);

module.exports = router; 