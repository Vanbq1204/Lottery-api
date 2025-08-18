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

module.exports = router; 