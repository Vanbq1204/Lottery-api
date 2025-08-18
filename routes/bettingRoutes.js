const express = require('express');
const router = express.Router();
const { 
  submitBets, 
  getEmployeeBets, 
  getStoreBets 
} = require('../controllers/bettingController');
const { authenticateToken, requireRole } = require('../controllers/authController');
const { checkBettingTimeAllowed } = require('../middleware/timeCheck');

// POST /api/betting/submit - Gửi cược (chỉ employee) - có kiểm tra thời gian
router.post('/submit', authenticateToken, requireRole(['employee']), checkBettingTimeAllowed, submitBets);

// GET /api/betting/employee - Lấy danh sách cược của nhân viên
router.get('/employee', authenticateToken, requireRole(['employee']), getEmployeeBets);

// GET /api/betting/store - Thống kê cược theo store (admin, superadmin)
router.get('/store', authenticateToken, requireRole(['admin', 'superadmin']), getStoreBets);

module.exports = router; 