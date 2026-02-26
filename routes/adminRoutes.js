const express = require('express');
const router = express.Router();
const { getMyStores, getStoreDetail, getStoreStatistics, updateStoreTimeSettings, getAutoExportSetting, updateAutoExportSetting } = require('../controllers/adminController');
const { getAdminTotalStatistics } = require('../controllers/adminTotalStatsController');
const { getAdminPrizeStatistics } = require('../controllers/adminPrizeStatsController');
const { getStorePrizeStatistics } = require('../controllers/adminStorePrizeStatsController');
const { getTimeSettings, updateTimeSettings, checkBettingAllowed } = require('../controllers/timeSettingsController');
const { getCleanupStats, performCleanup } = require('../controllers/dataCleanupController');
const { exportMessages, getExportHistory, reexportSnapshot } = require('../controllers/messageExportController');
const { listRequests: listInvoiceChangeRequests, decideRequest: decideInvoiceChangeRequest } = require('../controllers/invoiceChangeRequestController');
const { getAllGroupsForAdmin } = require('../controllers/specialNumberGroupController');
const { authenticateToken, changePassword } = require('../controllers/authController');
const { getAdminDailyReports } = require('../controllers/adminDailyReportController');

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

// Route cập nhật cài đặt thời gian cho cửa hàng cụ thể
router.put('/stores/:storeId/time-settings', authenticateToken, requireAdmin, updateStoreTimeSettings);

// Route lấy thống kê tổng hợp của admin
router.get('/total-statistics', authenticateToken, requireAdmin, getAdminTotalStatistics);

// Route lấy thống kê thưởng tổng hợp của admin
router.get('/prize-statistics', authenticateToken, requireAdmin, getAdminPrizeStatistics);

// Route lấy thống kê thưởng cho cửa hàng cụ thể
router.get('/store-prize-statistics', authenticateToken, requireAdmin, getStorePrizeStatistics);

// Routes quản lý thời gian nhập cược
router.get('/time-settings', authenticateToken, requireAdmin, getTimeSettings);
router.put('/time-settings', authenticateToken, requireAdmin, updateTimeSettings);
router.get('/check-betting-allowed', checkBettingAllowed);

// Route cho chức năng làm sạch dữ liệu
router.get('/data-cleanup/stats', authenticateToken, requireAdmin, getCleanupStats);
router.delete('/data-cleanup', authenticateToken, requireAdmin, performCleanup);

// Routes xuất tin nhắn theo khoảng thời gian và lịch sử
router.post('/message-exports/export', authenticateToken, requireAdmin, exportMessages);
router.get('/message-exports/history', authenticateToken, requireAdmin, getExportHistory);
router.put('/message-exports/reexport/:snapshotId', authenticateToken, requireAdmin, reexportSnapshot);
router.get('/message-exports/auto-setting', authenticateToken, requireAdmin, getAutoExportSetting);
router.put('/message-exports/auto-setting', authenticateToken, requireAdmin, updateAutoExportSetting);
router.get('/message-exports/multipliers', authenticateToken, requireAdmin, require('../controllers/adminController').getExportMultipliers);
router.put('/message-exports/multipliers', authenticateToken, requireAdmin, require('../controllers/adminController').updateExportMultipliers);

// Đổi mật khẩu admin (tự đổi)
router.put('/change-password', authenticateToken, requireAdmin, changePassword);

// Danh sách yêu cầu chỉnh sửa/xóa hóa đơn và phê duyệt
router.get('/invoice-change-requests', authenticateToken, requireAdmin, listInvoiceChangeRequests);
router.put('/invoice-change-requests/:requestId', authenticateToken, requireAdmin, decideInvoiceChangeRequest);

// Báo cáo cuối ngày theo cửa hàng cho admin
router.get('/daily-reports', authenticateToken, requireAdmin, getAdminDailyReports);

// Lấy danh sách special number groups (Bo dynamic) thuộc quyền admin
router.get('/special-number-groups', authenticateToken, requireAdmin, getAllGroupsForAdmin);

// Lịch sử sửa đổi hóa đơn theo cửa hàng
router.get('/invoice-history/:storeId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { storeId } = req.params;
    const adminId = req.user.id;
    const InvoiceHistory = require('../models/InvoiceHistory');
    const Store = require('../models/Store');

    // Verify store belongs to this admin
    const store = await Store.findOne({ _id: storeId, adminId });
    if (!store) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập cửa hàng này' });
    }

    // Get history for this store
    const history = await InvoiceHistory.find({ storeId })
      .populate('employeeId', 'name username')
      .sort({ actionDate: -1 })
      .limit(100); // Giới hạn 100 records gần nhất

    res.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching invoice history:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch sử' });
  }
});

module.exports = router;
