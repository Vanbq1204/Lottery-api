const GlobalSettings = require('../models/GlobalSettings');

// GET status: last force relogin time
const getForceReloginStatus = async (req, res) => {
  try {
    const settings = await GlobalSettings.findOne({ key: 'global' });
    return res.json({ success: true, forceReloginAt: settings?.forceReloginAt || null });
  } catch (error) {
    console.error('Get force relogin status error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy trạng thái' });
  }
};

// POST: force relogin now for all users
const forceRelogin = async (req, res) => {
  try {
    let settings = await GlobalSettings.findOne({ key: 'global' });
    if (!settings) {
      settings = new GlobalSettings({ key: 'global' });
    }
    settings.forceReloginAt = new Date();
    await settings.save();
    return res.json({ success: true, message: 'Đã yêu cầu tất cả người dùng đăng nhập lại', forceReloginAt: settings.forceReloginAt });
  } catch (error) {
    console.error('Force relogin error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi yêu cầu đăng nhập lại' });
  }
};

// Kích hoạt reload trang toàn hệ thống
const forceReload = async (req, res) => {
  try {
    const io = req.app.get('socketio');
    if (!io) {
      return res.status(500).json({ success: false, message: 'Socket.io not available' });
    }

    // Broadcast event reload đến tất cả clients
    io.emit('force-reload', {
      message: 'SuperAdmin đã yêu cầu reload trang',
      timestamp: new Date().toISOString()
    });

    console.log('🔄 Force reload event broadcasted to all clients');

    return res.json({
      success: true,
      message: 'Đã gửi yêu cầu reload trang đến tất cả người dùng'
    });
  } catch (err) {
    console.error('Error force reload:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// GET maintenance mode status
const getMaintenanceStatus = async (req, res) => {
  try {
    const settings = await GlobalSettings.findOne({ key: 'global' });
    return res.json({
      success: true,
      maintenanceMode: settings?.maintenanceMode || false,
      maintenanceActivatedAt: settings?.maintenanceActivatedAt || null
    });
  } catch (error) {
    console.error('Get maintenance status error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy trạng thái bảo trì' });
  }
};

// POST: set maintenance mode (on/off)
const setMaintenanceMode = async (req, res) => {
  try {
    const { enabled } = req.body; // true = bật bảo trì, false = tắt bảo trì

    let settings = await GlobalSettings.findOne({ key: 'global' });
    if (!settings) {
      settings = new GlobalSettings({ key: 'global' });
    }

    settings.maintenanceMode = enabled;
    settings.maintenanceActivatedAt = enabled ? new Date() : null;
    await settings.save();

    // Nếu bật bảo trì, broadcast event để logout tất cả users
    if (enabled) {
      const io = req.app.get('socketio');
      if (io) {
        io.emit('maintenance-mode-activated', {
          message: 'Hệ thống đang bảo trì, vui lòng đăng xuất',
          timestamp: new Date().toISOString()
        });
      }
    }

    return res.json({
      success: true,
      message: enabled ? 'Đã kích hoạt chế độ bảo trì' : 'Đã tắt chế độ bảo trì',
      maintenanceMode: settings.maintenanceMode,
      maintenanceActivatedAt: settings.maintenanceActivatedAt
    });
  } catch (error) {
    console.error('Set maintenance mode error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái bảo trì' });
  }
};

module.exports = {
  getForceReloginStatus,
  forceRelogin,
  forceReload,
  getMaintenanceStatus,
  setMaintenanceMode
};