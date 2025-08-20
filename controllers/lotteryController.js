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

    // Get store info
    const store = await Store.findById(user.storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Cửa hàng không tồn tại' });
    }

    // Check if lottery result already exists for this turnNum + storeId
    const existingResult = await LotteryResult.findOne({ 
      turnNum, 
      storeId: user.storeId 
    });
    
    if (existingResult) {
      // Update existing result
      existingResult.openTime = openTime;
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
        openTime,
        results,
        createdBy: userId,
        storeId: user.storeId,
        adminId: store.adminId
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

    // Build query based on user role
    let query = {};
    
    if (user.role === 'admin') {
      // Admin can see all results from their stores
      const stores = await Store.find({ adminId: userId });
      const storeIds = stores.map(store => store._id);
      query.storeId = { $in: storeIds };
    } else {
      // Employee can only see results from their store
      query.storeId = user.storeId;
    }

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
      .populate('storeId', 'name address')
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
      message: 'Lỗi server khi lấy kết quả xổ số',
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

    // Build query based on user role
    let query = { turnNum };
    
    if (user.role === 'admin') {
      // Admin can see results from their stores
      const stores = await Store.find({ adminId: userId });
      const storeIds = stores.map(store => store._id);
      query.storeId = { $in: storeIds };
    } else {
      // Employee can only see results from their store
      query.storeId = user.storeId;
    }

    const lotteryResult = await LotteryResult.findOne(query)
      .populate('createdBy', 'name username')
      .populate('storeId', 'name address')
      .populate('adminId', 'name email');

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
    const user = req.user; // req.user is already the full user object from middleware
    const userId = user._id;

    // Build query based on user role
    let query = { turnNum };
    
    if (user.role === 'admin') {
      // Admin can delete results from their stores
      const stores = await Store.find({ adminId: userId });
      const storeIds = stores.map(store => store._id);
      query.storeId = { $in: storeIds };
    } else {
      // Employee can only delete results from their store
      query.storeId = user.storeId;
    }

    const lotteryResult = await LotteryResult.findOneAndDelete(query);

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