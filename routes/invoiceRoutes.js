const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../controllers/authController');
const { checkBettingTimeAllowed, checkEditDeleteTimeAllowed } = require('../middleware/timeCheck');
const {
  saveInvoice,
  getInvoicesByStore,
  getInvoicesByAdmin,
  getInvoiceDetail,
  getInvoiceStats,
  editInvoice,
  deleteInvoice,
  getInvoiceHistory,
  getHistoryByDate,
  checkInvoiceExists
} = require('../controllers/invoiceController');

// Lưu hóa đơn mới (chỉ employee) - có kiểm tra thời gian
router.post('/save', authenticateToken, checkBettingTimeAllowed, saveInvoice);

// Sửa hóa đơn - có kiểm tra thời gian
router.put('/edit/:invoiceId', authenticateToken, checkEditDeleteTimeAllowed, editInvoice);

// Xóa hóa đơn - có kiểm tra thời gian
router.delete('/delete/:invoiceId', authenticateToken, checkEditDeleteTimeAllowed, deleteInvoice);

// Lấy danh sách hóa đơn theo store (employee)
router.get('/store', authenticateToken, getInvoicesByStore);

// Lấy danh sách hóa đơn theo admin (admin)
router.get('/admin', authenticateToken, getInvoicesByAdmin);

// Lấy chi tiết hóa đơn
router.get('/detail/:invoiceId', authenticateToken, getInvoiceDetail);

// Thống kê hóa đơn
router.get('/stats', authenticateToken, getInvoiceStats);

// Lấy lịch sử sửa đổi
router.get('/history', authenticateToken, getInvoiceHistory);

// Lấy lịch sử theo ngày
router.get('/history/:date', authenticateToken, getHistoryByDate);

router.get('/check/:invoiceId', authenticateToken, checkInvoiceExists);

module.exports = router;