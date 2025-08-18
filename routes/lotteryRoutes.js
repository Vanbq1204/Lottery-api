const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../controllers/authController');
const {
  saveLotteryResult,
  getLotteryResults,
  getLotteryResultById,
  deleteLotteryResult
} = require('../controllers/lotteryController');

// Save lottery result (POST /api/lottery/save)
router.post('/save', authenticateToken, saveLotteryResult);

// Get lottery results (GET /api/lottery/results)
router.get('/results', authenticateToken, getLotteryResults);

// Get lottery result by turnNum (GET /api/lottery/result/:turnNum)
router.get('/result/:turnNum', authenticateToken, getLotteryResultById);

// Delete lottery result (DELETE /api/lottery/result/:turnNum)
router.delete('/result/:turnNum', authenticateToken, deleteLotteryResult);

module.exports = router; 