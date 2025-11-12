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

module.exports = { getForceReloginStatus, forceRelogin };