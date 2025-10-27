const TimeSettings = require('../models/TimeSettings');
const { getCurrentVietnamTime, isBeforeCutoffTime } = require('../utils/dateUtils');

// Lấy cài đặt thời gian của admin
const getTimeSettings = async (req, res) => {
  try {
    const adminId = req.user.id;
    
    let timeSettings = await TimeSettings.findOne({ adminId });
    
    // Nếu chưa có settings, tạo mặc định
    if (!timeSettings) {
      timeSettings = new TimeSettings({
        adminId,
        bettingCutoffTime: "18:30",
        updatedBy: adminId
      });
      await timeSettings.save();
    }
    
    res.json({
      success: true,
      settings: timeSettings
    });
    
  } catch (error) {
    console.error('Get time settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy cài đặt thời gian'
    });
  }
};

// Cập nhật cài đặt thời gian
const updateTimeSettings = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { 
      bettingCutoffTime, 
      isActive, 
      editDeleteCutoffTime, 
      editDeleteLimitActive,
      // Thêm trường chung cho lô, xiên, xiên quay
      specialBetsCutoffTime,
      specialBetsLimitActive
    } = req.body;
    
    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(bettingCutoffTime)) {
      return res.status(400).json({
        success: false,
        message: 'Định dạng thời gian không hợp lệ. Vui lòng sử dụng định dạng HH:MM (24h)'
      });
    }
    
    // Validate editDeleteCutoffTime if provided
    if (editDeleteCutoffTime && !timeRegex.test(editDeleteCutoffTime)) {
      return res.status(400).json({
        success: false,
        message: 'Định dạng thời gian giới hạn sửa/xóa không hợp lệ. Vui lòng sử dụng định dạng HH:MM (24h)'
      });
    }
    
    // Validate thời gian lô, xiên, xiên quay
    if (specialBetsCutoffTime && !timeRegex.test(specialBetsCutoffTime)) {
      return res.status(400).json({
        success: false,
        message: 'Định dạng thời gian giới hạn lô, xiên, xiên quay không hợp lệ. Vui lòng sử dụng định dạng HH:MM (24h)'
      });
    }
    
    let timeSettings = await TimeSettings.findOne({ adminId });
    
    if (timeSettings) {
      // Cập nhật existing settings
      timeSettings.bettingCutoffTime = bettingCutoffTime;
      timeSettings.isActive = isActive !== undefined ? isActive : timeSettings.isActive;
      
      // Cập nhật thời gian giới hạn sửa/xóa nếu có
      if (editDeleteCutoffTime) {
        timeSettings.editDeleteCutoffTime = editDeleteCutoffTime;
      }
      
      // Cập nhật trạng thái kích hoạt giới hạn sửa/xóa
      if (editDeleteLimitActive !== undefined) {
        timeSettings.editDeleteLimitActive = editDeleteLimitActive;
      }
      
      // Cập nhật thời gian và trạng thái cho lô, xiên, xiên quay (chung)
      if (specialBetsCutoffTime) {
        timeSettings.specialBetsCutoffTime = specialBetsCutoffTime;
      }
      
      if (specialBetsLimitActive !== undefined) {
        timeSettings.specialBetsLimitActive = specialBetsLimitActive;
      }
      
      timeSettings.updatedBy = adminId;
      await timeSettings.save();
    } else {
      // Tạo mới
      timeSettings = new TimeSettings({
        adminId,
        bettingCutoffTime,
        isActive: isActive !== undefined ? isActive : true,
        editDeleteCutoffTime: editDeleteCutoffTime || "18:15",
        editDeleteLimitActive: editDeleteLimitActive !== undefined ? editDeleteLimitActive : false,
        // Thêm trường chung
        specialBetsCutoffTime: specialBetsCutoffTime || "18:15",
        specialBetsLimitActive: specialBetsLimitActive !== undefined ? specialBetsLimitActive : false,
        updatedBy: adminId
      });
      await timeSettings.save();
    }
    
    res.json({
      success: true,
      message: 'Cập nhật cài đặt thời gian thành công',
      settings: timeSettings
    });
    
  } catch (error) {
    console.error('Update time settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật cài đặt thời gian'
    });
  }
};

// Kiểm tra xem có được phép nhập cược không (dùng cho employee)
const checkBettingAllowed = async (req, res) => {
  try {
    const { adminId } = req.query;
    
    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: 'Admin ID là bắt buộc'
      });
    }
    
    const timeSettings = await TimeSettings.findOne({ adminId });
    
    if (!timeSettings || !timeSettings.isActive) {
      return res.json({
        success: true,
        allowed: true,
        message: 'Không có giới hạn thời gian'
      });
    }
    
    // Kiểm tra thời gian hiện tại (Vietnam timezone)
    const currentTime = getCurrentVietnamTime();
    const allowed = isBeforeCutoffTime(timeSettings.bettingCutoffTime);
    
    res.json({
      success: true,
      allowed,
      cutoffTime: timeSettings.bettingCutoffTime,
      currentTime,
      message: allowed ? 
        'Được phép nhập cược' : 
        `Đã quá thời gian quy định (${timeSettings.bettingCutoffTime}). Hiện tại: ${currentTime}`
    });
    
  } catch (error) {
    console.error('Check betting allowed error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi kiểm tra thời gian'
    });
  }
};

module.exports = {
  getTimeSettings,
  updateTimeSettings,
  checkBettingAllowed
};