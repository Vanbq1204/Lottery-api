const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole, changePassword } = require('../controllers/authController');
const { createRequest: createInvoiceChangeRequest } = require('../controllers/invoiceChangeRequestController');
const { getLotoMultiplier, updateLotoMultiplier } = require('../controllers/lotoMultiplierController');
const { listGroups, createGroup, updateGroup, deleteGroup } = require('../controllers/specialNumberGroupController');

// Routes cho hệ số lô
router.get('/loto-multiplier', authenticateToken, requireRole(['employee']), getLotoMultiplier);
router.put('/loto-multiplier', authenticateToken, requireRole(['employee']), updateLotoMultiplier);

// Cài đặt: Bộ số đặc biệt cho 2 số (store-scoped)
router.get('/special-number-groups', authenticateToken, requireRole(['employee']), listGroups);
router.post('/special-number-groups', authenticateToken, requireRole(['employee']), createGroup);
router.put('/special-number-groups/:groupId', authenticateToken, requireRole(['employee']), updateGroup);
router.delete('/special-number-groups/:groupId', authenticateToken, requireRole(['employee']), deleteGroup);

// Đổi mật khẩu cho nhân viên
router.put('/change-password', authenticateToken, requireRole(['employee']), changePassword);

// Yêu cầu chỉnh sửa/xóa hóa đơn (nhân viên gửi)
router.post('/invoice-change-requests', authenticateToken, requireRole(['employee']), createInvoiceChangeRequest);

module.exports = router;