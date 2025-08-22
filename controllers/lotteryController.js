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

    // Check if lottery result already exists for this turnNum (global, không phụ thuộc store)
    const existingResult = await LotteryResult.findOne({ turnNum });
    
    if (existingResult) {
      // Update existing result
      existingResult.openTime = openTimeDate;
      existingResult.results = results;
      existingResult.createdBy = userId;
      
      await existingResult.save();
      
      return res.status(200).json({
        success: true,
        message: 'Cập nhật kết quả xổ số thành công',
        lotteryResult: existingResult
      });
    } else {
      // Create new result
      const newLotteryResult = new LotteryResult({
        turnNum,
        openTime: openTimeDate,
        results,
        createdBy: userId
        // Loại bỏ storeId và adminId - tất cả store sử dụng chung kết quả
      });

      await newLotteryResult.save();

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