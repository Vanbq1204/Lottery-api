const express = require('express');
const router = express.Router();
const { login, authenticateToken, getProfile } = require('../controllers/authController');
const Store = require('../models/Store'); // Added import for Store model
const GlobalSettings = require('../models/GlobalSettings');

// GET /api/auth/maintenance - Kiểm tra trạng thái bảo trì (public)
router.get('/maintenance', async (req, res) => {
  try {
    const settings = await GlobalSettings.findOne({ key: 'global' });
    res.json({
      success: true,
      maintenanceMode: settings?.maintenanceMode || false,
      maintenanceActivatedAt: settings?.maintenanceActivatedAt || null
    });
  } catch (error) {
    console.error('Get maintenance status error:', error);
    res.json({ success: true, maintenanceMode: false });
  }
});

// POST /api/auth/login - Đăng nhập
router.post('/login', login);

// GET /api/auth/profile - Lấy thông tin profile (cần token)
router.get('/profile', authenticateToken, getProfile);

// Get store information
router.get('/store/:storeId', authenticateToken, async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findById(storeId)
      .populate('adminId', 'name email')
      .populate('employees', 'name username');

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cửa hàng'
      });
    }

    res.json({
      success: true,
      store
    });
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin cửa hàng'
    });
  }
});

module.exports = router; 