const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../controllers/authController');
const {
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getAvailableStores,
  getStoresByAdmin,
  createStore,
  updateStore,
  deleteStore
} = require('../controllers/superAdminController');

// Middleware kiểm tra quyền super admin
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ Super Admin mới có quyền truy cập'
    });
  }
  next();
};

// Routes quản lý admin
router.get('/admins', authenticateToken, requireSuperAdmin, getAllAdmins);
router.post('/admins', authenticateToken, requireSuperAdmin, createAdmin);
router.put('/admins/:adminId', authenticateToken, requireSuperAdmin, updateAdmin);
router.delete('/admins/:adminId', authenticateToken, requireSuperAdmin, deleteAdmin);

// Route lấy stores chưa có admin
router.get('/available-stores', authenticateToken, requireSuperAdmin, getAvailableStores);

// Routes quản lý cửa hàng
router.get('/stores/:adminId', authenticateToken, requireSuperAdmin, getStoresByAdmin);
router.post('/stores', authenticateToken, requireSuperAdmin, createStore);
router.put('/stores/:storeId', authenticateToken, requireSuperAdmin, updateStore);
router.delete('/stores/:storeId', authenticateToken, requireSuperAdmin, deleteStore);

// Thống kê toàn bộ hệ thống (gộp theo admin)
const { getSystemStatistics, getAdminStoreStatistics } = require('../controllers/superAdminSystemStatsController');
const { getForceReloginStatus, forceRelogin, forceReload } = require('../controllers/superAdminSessionController');
const { getSuperAdminCleanupStats, performSuperAdminCleanup } = require('../controllers/superAdminCleanupController');
const { getLotteryHistory, deleteLotteryHistoryByDate } = require('../controllers/superAdminLotteryHistoryController');
router.get('/system-statistics', authenticateToken, requireSuperAdmin, getSystemStatistics);
router.get('/system-statistics/stores', authenticateToken, requireSuperAdmin, getAdminStoreStatistics);
// Lịch sử hệ thống: lịch sử kết quả xổ số
router.get('/system-history/lottery', authenticateToken, requireSuperAdmin, getLotteryHistory);
router.delete('/system-history/lottery', authenticateToken, requireSuperAdmin, deleteLotteryHistoryByDate);

// Làm sạch dữ liệu theo ngày cho admin
router.get('/cleanup/stats', authenticateToken, requireSuperAdmin, getSuperAdminCleanupStats);
router.delete('/cleanup', authenticateToken, requireSuperAdmin, performSuperAdminCleanup);

// Yêu cầu đăng nhập lại toàn hệ thống
router.get('/session/force-relogin/status', authenticateToken, requireSuperAdmin, getForceReloginStatus);
router.post('/session/force-relogin', authenticateToken, requireSuperAdmin, forceRelogin);

// Yêu cầu reload trang toàn hệ thống
router.post('/session/force-reload', authenticateToken, requireSuperAdmin, forceReload);

module.exports = router;