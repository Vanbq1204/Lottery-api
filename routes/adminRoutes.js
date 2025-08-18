const express = require('express');
const router = express.Router();
const { getMyStores, getStoreDetail, getStoreStatistics } = require('../controllers/adminController');
const { getAdminTotalStatistics } = require('../controllers/adminTotalStatsController');
const { getAdminPrizeStatistics } = require('../controllers/adminPrizeStatsController');
const { getTimeSettings, updateTimeSettings, checkBettingAllowed } = require('../controllers/timeSettingsController');
const { authenticateToken } = require('../controllers/authController');

// Middleware kiểm tra quyền admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Yêu cầu quyền admin'
    });
  }
  next();
};

// Route lấy danh sách cửa hàng của admin
router.get('/my-stores', authenticateToken, requireAdmin, getMyStores);

// Route lấy chi tiết cửa hàng
router.get('/stores/:storeId', authenticateToken, requireAdmin, getStoreDetail);

// Route lấy thống kê cửa hàng
router.get('/store-statistics', authenticateToken, requireAdmin, getStoreStatistics);

// Route lấy thống kê tổng hợp của admin
router.get('/total-statistics', authenticateToken, requireAdmin, getAdminTotalStatistics);

// Route lấy thống kê thưởng tổng hợp của admin
router.get('/prize-statistics', authenticateToken, requireAdmin, getAdminPrizeStatistics);

// Routes quản lý thời gian nhập cược
router.get('/time-settings', authenticateToken, requireAdmin, getTimeSettings);
router.put('/time-settings', authenticateToken, requireAdmin, updateTimeSettings);
router.get('/check-betting-allowed', checkBettingAllowed);

module.exports = router; 