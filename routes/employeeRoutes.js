const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole, changePassword } = require('../controllers/authController');
const { createRequest: createInvoiceChangeRequest } = require('../controllers/invoiceChangeRequestController');
const { getLotoMultiplier, updateLotoMultiplier } = require('../controllers/lotoMultiplierController');

// Routes cho hệ số lô
router.get('/loto-multiplier', authenticateToken, requireRole(['employee']), getLotoMultiplier);
router.put('/loto-multiplier', authenticateToken, requireRole(['employee']), updateLotoMultiplier);

// Đổi mật khẩu cho nhân viên
router.put('/change-password', authenticateToken, requireRole(['employee']), changePassword);

// Yêu cầu chỉnh sửa/xóa hóa đơn (nhân viên gửi)
router.post('/invoice-change-requests', authenticateToken, requireRole(['employee']), createInvoiceChangeRequest);

module.exports = router;