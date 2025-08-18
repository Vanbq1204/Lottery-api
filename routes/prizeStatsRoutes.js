const express = require('express');
const router = express.Router();
const { getPrizeStatistics } = require('../controllers/prizeStatsController');
const { authenticateToken } = require('../controllers/authController');

// Route thống kê thưởng theo ngày
router.get('/statistics', authenticateToken, getPrizeStatistics);

module.exports = router; 