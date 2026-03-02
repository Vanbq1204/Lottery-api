const LotteryResult = require('../models/lotteryResult');
const User = require('../models/User');
const Store = require('../models/Store');

// Save lottery result
const saveLotteryResult = async (req, res) => {
  try {
    const { turnNum, openTime, results } = req.body;
    const user = req.user; // req.user is already the full user object from middleware
    const userId = user._id;

    console.log('Save lottery - User:', user.username, 'UserId:', userId);
    console.log('Save lottery - Data:', { turnNum, openTime, results });

    // Convert openTime to Date if it's a string, or use current time if null/undefined
    let openTimeDate;
    if (openTime) {
      openTimeDate = typeof openTime === 'string' ? new Date(openTime) : openTime;
    } else {
      openTimeDate = new Date();
    }
    console.log('Save lottery - openTimeDate:', openTimeDate);

    // Permission: nếu là nhân viên, chỉ cho phép nếu cửa hàng được cấp quyền nhập kết quả
    if (user.role === 'employee') {
      const Store = require('../models/Store');
      const store = await Store.findById(user.storeId);
      if (!store || !store.showLotteryResults) {
        return res.status(403).json({
          success: false,
          message: 'Cửa hàng không có quyền nhập kết quả xổ số'
        });
      }
    }

    // Check if lottery result already exists for this turnNum (global, không phụ thuộc store)
    const existingResult = await LotteryResult.findOne({ turnNum });

    const LotteryResultHistory = require('../models/LotteryResultHistory');

    const toArray = (arr) => Array.isArray(arr) ? arr.map(x => (x || '').trim()) : [];
    const normalizeResults = (r) => ({
      gdb: (r?.gdb || '').trim(),
      g1: (r?.g1 || '').trim(),
      g2: toArray(r?.g2),
      g3: toArray(r?.g3),
      g4: toArray(r?.g4),
      g5: toArray(r?.g5),
      g6: toArray(r?.g6),
      g7: toArray(r?.g7)
    });

    if (existingResult) {
      // Update existing result
      existingResult.openTime = openTimeDate;
      const before = normalizeResults(existingResult.results || {});
      const after = normalizeResults(results || {});
      existingResult.results = after;
      existingResult.createdBy = userId;

      await existingResult.save();

      // Ghi lịch sử cập nhật
      try {
        let store, admin;
        if (user.role === 'employee' && user.storeId) {
          const Store = require('../models/Store');
          store = await Store.findById(user.storeId).populate('adminId');
        }
        await LotteryResultHistory.create({
          turnNum,
          action: 'update',
          changedBy: userId,
          changedByName: user.name,
          changedByUsername: user.username,
          storeId: store?._id,
          storeName: store?.name,
          adminId: store?.adminId?._id,
          adminName: store?.adminId?.name,
          beforeResults: before,
          afterResults: after
        });
      } catch (histErr) {
        console.error('Write lottery history error:', histErr);
      }

      // Phát sự kiện socket cho tất cả client
      const io = req.app.get('socketio');
      if (io) {
        io.emit('lottery_result_updated', { turnNum, date: openTimeDate });
      }

      return res.status(200).json({
        success: true,
        message: 'Cập nhật kết quả xổ số thành công',
        lotteryResult: existingResult
      });
    } else {
      // Create new result
      const normalized = normalizeResults(results || {});
      const newLotteryResult = new LotteryResult({
        turnNum,
        openTime: openTimeDate,
        results: normalized,
        createdBy: userId
        // Loại bỏ storeId và adminId - tất cả store sử dụng chung kết quả
      });

      await newLotteryResult.save();

      // Ghi lịch sử tạo mới (lần nhập đầu tiên trong ngày)
      try {
        let store, admin;
        if (user.role === 'employee' && user.storeId) {
          const Store = require('../models/Store');
          store = await Store.findById(user.storeId).populate('adminId');
        }
        await LotteryResultHistory.create({
          turnNum,
          action: 'create',
          changedBy: userId,
          changedByName: user.name,
          changedByUsername: user.username,
          storeId: store?._id,
          storeName: store?.name,
          adminId: store?.adminId?._id,
          adminName: store?.adminId?.name,
          beforeResults: normalizeResults({}),
          afterResults: normalized
        });
      } catch (histErr) {
        console.error('Write lottery history error:', histErr);
      }

      // Phát sự kiện socket cho tất cả client
      const io = req.app.get('socketio');
      if (io) {
        io.emit('lottery_result_updated', { turnNum, date: openTimeDate });
      }

      return res.status(201).json({
        success: true,
        message: 'Lưu kết quả xổ số thành công',
        lotteryResult: newLotteryResult
      });
    }
  } catch (error) {
    console.error('Save lottery result error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lưu kết quả xổ số',
      error: error.message
    });
  }
};

// Get lottery results (for admin or store)
const getLotteryResults = async (req, res) => {
  try {
    const user = req.user; // req.user is already the full user object from middleware
    const userId = user._id;
    const { page = 1, limit = 10, startDate, endDate, date } = req.query;

    // Build query - không cần filter theo storeId nữa
    let query = {};

    // Add date filter if provided
    if (date) {
      // Convert YYYY-MM-DD to DD/MM/YYYY format for turnNum
      const [year, month, day] = date.split('-');
      const turnNumFormat = `${day}/${month}/${year}`;
      query.turnNum = turnNumFormat;
    } else if (startDate || endDate) {
      query.openTime = {};
      if (startDate) query.openTime.$gte = new Date(startDate);
      if (endDate) query.openTime.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const lotteryResults = await LotteryResult.find(query)
      .populate('createdBy', 'name username')
      .sort({ openTime: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await LotteryResult.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));

    return res.status(200).json({
      success: true,
      lotteryResults,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        total,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get lottery results error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách kết quả xổ số',
      error: error.message
    });
  }
};

// Get lottery result by turnNum
const getLotteryResultById = async (req, res) => {
  try {
    const { turnNum } = req.params;
    const user = req.user; // req.user is already the full user object from middleware
    const userId = user._id;

    // Query chỉ dựa vào turnNum - không cần filter theo store
    const query = { turnNum };

    const lotteryResult = await LotteryResult.findOne(query)
      .populate('createdBy', 'name username');

    if (!lotteryResult) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kết quả xổ số'
      });
    }

    return res.status(200).json({
      success: true,
      lotteryResult
    });
  } catch (error) {
    console.error('Get lottery result by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy kết quả xổ số',
      error: error.message
    });
  }
};

// Delete lottery result
const deleteLotteryResult = async (req, res) => {
  try {
    const { turnNum } = req.params;
    const user = req.user;

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền xóa kết quả xổ số'
      });
    }

    const lotteryResult = await LotteryResult.findOneAndDelete({ turnNum });

    if (!lotteryResult) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kết quả xổ số để xóa'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Xóa kết quả xổ số thành công'
    });
  } catch (error) {
    console.error('Delete lottery result error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa kết quả xổ số',
      error: error.message
    });
  }
};

module.exports = {
  saveLotteryResult,
  getLotteryResults,
  getLotteryResultById,
  deleteLotteryResult
};