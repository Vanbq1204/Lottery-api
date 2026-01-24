const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../controllers/authController');
const autoCleanupController = require('../controllers/autoCleanupController');

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

// Lấy tất cả cài đặt auto cleanup (SuperAdmin only)
router.get('/settings', authenticateToken, requireSuperAdmin, autoCleanupController.getAllAutoCleanupSettings);

// Cập nhật cài đặt auto cleanup cho một admin (SuperAdmin only)
router.put('/settings', authenticateToken, requireSuperAdmin, autoCleanupController.updateAutoCleanupSettings);

// Trigger manual cleanup (SuperAdmin only, for testing)
router.post('/trigger', authenticateToken, requireSuperAdmin, autoCleanupController.triggerManualCleanup);

module.exports = router;
