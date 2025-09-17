const TimeSettings = require('../models/TimeSettings');
const Store = require('../models/Store');
const { getCurrentVietnamTime, isBeforeCutoffTime } = require('../utils/dateUtils');

// Middleware kiểm tra thời gian nhập cược
const checkBettingTimeAllowed = async (req, res, next) => {
  try {
    // Chỉ áp dụng cho employee
    if (req.user.role !== 'employee') {
      return next();
    }

    // Lấy thông tin store của employee để biết adminId
    const store = await Store.findById(req.user.storeId);
    if (!store) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy thông tin cửa hàng'
      });
    }

    const adminId = store.adminId;

    // Lấy cài đặt thời gian của admin
    const timeSettings = await TimeSettings.findOne({ adminId });

    // Nếu không có cài đặt hoặc không kích hoạt, cho phép
    if (!timeSettings || !timeSettings.isActive) {
      return next();
    }

    // Kiểm tra thời gian hiện tại (Vietnam timezone)
    const currentTime = getCurrentVietnamTime();
    const allowed = isBeforeCutoffTime(timeSettings.bettingCutoffTime);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: `Hóa đơn này sẽ không được lưu vì đã quá thời gian quy định (${timeSettings.bettingCutoffTime}). Hiện tại: ${currentTime}`,
        cutoffTime: timeSettings.bettingCutoffTime,
        currentTime: currentTime,
        code: 'BETTING_TIME_EXPIRED'
      });
    }

    // Thêm thông tin thời gian vào request để log
    req.bettingTimeInfo = {
      cutoffTime: timeSettings.bettingCutoffTime,
      currentTime: currentTime,
      adminId: adminId.toString()
    };

    next();

  } catch (error) {
    console.error('Time check middleware error:', error);
    // Nếu có lỗi trong middleware, vẫn cho phép tiếp tục (fail-safe)
    next();
  }
};

// Middleware kiểm tra thời gian sửa/xóa hóa đơn
const checkEditDeleteTimeAllowed = async (req, res, next) => {
  try {
    // Chỉ áp dụng cho employee
    if (req.user.role !== 'employee') {
      return next();
    }

    // Lấy thông tin store của employee để biết adminId
    const store = await Store.findById(req.user.storeId);
    if (!store) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy thông tin cửa hàng'
      });
    }

    const adminId = store.adminId;

    // Lấy cài đặt thời gian của admin
    const timeSettings = await TimeSettings.findOne({ adminId });

    // Nếu không có cài đặt hoặc không kích hoạt giới hạn sửa/xóa, cho phép
    if (!timeSettings || !timeSettings.editDeleteLimitActive) {
      return next();
    }

    // Kiểm tra thời gian hiện tại (Vietnam timezone)
    const currentTime = getCurrentVietnamTime();
    const allowed = isBeforeCutoffTime(timeSettings.editDeleteCutoffTime);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: `Không thể sửa hoặc xóa hóa đơn vì đã quá thời gian quy định (${timeSettings.editDeleteCutoffTime}). Hiện tại: ${currentTime}`,
        cutoffTime: timeSettings.editDeleteCutoffTime,
        currentTime: currentTime,
        code: 'EDIT_DELETE_TIME_EXPIRED'
      });
    }

    // Thêm thông tin thời gian vào request để log
    req.editDeleteTimeInfo = {
      cutoffTime: timeSettings.editDeleteCutoffTime,
      currentTime: currentTime,
      adminId: adminId.toString()
    };

    next();

  } catch (error) {
    console.error('Edit/Delete time check middleware error:', error);
    // Nếu có lỗi trong middleware, vẫn cho phép tiếp tục (fail-safe)
    next();
  }
};

module.exports = {
  checkBettingTimeAllowed,
  checkEditDeleteTimeAllowed
};