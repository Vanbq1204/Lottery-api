const express = require('express');
const router = express.Router();
const dailyReportController = require('../controllers/dailyReportController');
const { authenticateToken, requireRole } = require('../controllers/authController');

router.get('/', authenticateToken, requireRole(['employee']), dailyReportController.getDailyReport);
router.post('/', authenticateToken, requireRole(['employee']), dailyReportController.saveDailyReport);

module.exports = router;
