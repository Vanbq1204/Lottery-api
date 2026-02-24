const express = require('express');
const router = express.Router();
const debtController = require('../controllers/debtController');
const { authenticateToken, requireRole } = require('../controllers/authController');

// All routes require authentication and admin role (or employee mapping? Admin only makes more sense for "Sổ Tổng kết tin xuất").
router.use(authenticateToken);
router.use(requireRole(['admin', 'superadmin']));

router.get('/', debtController.getDebts);
router.post('/', debtController.updateDebt);
router.delete('/:date', debtController.deleteDebt);

module.exports = router;
