const LotoMultiplier = require('../models/LotoMultiplier');
const Store = require('../models/Store');

// Lấy hệ số lô của cửa hàng
const getLotoMultiplier = async (req, res) => {
  try {
    const { storeId } = req.user;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy thông tin cửa hàng'
      });
    }

    let multiplier = await LotoMultiplier.findOne({ storeId, isActive: true });

    // Nếu chưa có, tạo mới với giá trị mặc định
    if (!multiplier) {
      multiplier = new LotoMultiplier({
        storeId,
        multiplier: 22,
        updatedBy: req.user.id
      });
      await multiplier.save();
    }

    res.json({
      success: true,
      data: {
        multiplier: multiplier.multiplier,
        lastUpdated: multiplier.lastUpdated,
        storeId: multiplier.storeId
      }
    });

  } catch (error) {
    console.error('Lỗi khi lấy hệ số lô:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy hệ số lô'
    });
  }
};

// Cập nhật hệ số lô
const updateLotoMultiplier = async (req, res) => {
  try {
    const { multiplier } = req.body;
    const { storeId } = req.user;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy thông tin cửa hàng'
      });
    }

    // Validate multiplier
    if (!multiplier || multiplier < 1 || multiplier > 100) {
      return res.status(400).json({
        success: false,
        message: 'Hệ số phải từ 1 đến 100'
      });
    }

    // Tìm và cập nhật hoặc tạo mới
    let lotoMultiplier = await LotoMultiplier.findOne({ storeId });

    if (lotoMultiplier) {
      lotoMultiplier.multiplier = parseFloat(multiplier);
      lotoMultiplier.updatedBy = req.user.id;
      lotoMultiplier.lastUpdated = new Date();
      await lotoMultiplier.save();
    } else {
      lotoMultiplier = new LotoMultiplier({
        storeId,
        multiplier: parseFloat(multiplier),
        updatedBy: req.user.id
      });
      await lotoMultiplier.save();
    }

    res.json({
      success: true,
      message: 'Cập nhật hệ số lô thành công',
      data: {
        multiplier: lotoMultiplier.multiplier,
        lastUpdated: lotoMultiplier.lastUpdated
      }
    });

  } catch (error) {
    console.error('Lỗi khi cập nhật hệ số lô:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật hệ số lô'
    });
  }
};

// Helper function để lấy hệ số lô theo storeId (dùng cho tính toán)
const getLotoMultiplierByStoreId = async (storeId) => {
  try {
    let multiplier = await LotoMultiplier.findOne({ storeId, isActive: true });
    
    // Nếu chưa có, trả về giá trị mặc định
    if (!multiplier) {
      return 22;
    }
    
    return multiplier.multiplier;
  } catch (error) {
    console.error('Lỗi khi lấy hệ số lô theo storeId:', error);
    return 22; // Trả về giá trị mặc định nếu có lỗi
  }
};

// Khởi tạo hệ số lô mặc định cho cửa hàng mới
const initializeLotoMultiplier = async (storeId) => {
  try {
    const existingMultiplier = await LotoMultiplier.findOne({ storeId });
    
    if (!existingMultiplier) {
      const newMultiplier = new LotoMultiplier({
        storeId,
        multiplier: 22
      });
      await newMultiplier.save();
      console.log(`Đã khởi tạo hệ số lô mặc định cho cửa hàng ${storeId}`);
    }
  } catch (error) {
    console.error('Lỗi khi khởi tạo hệ số lô:', error);
  }
};

module.exports = {
  getLotoMultiplier,
  updateLotoMultiplier,
  getLotoMultiplierByStoreId,
  initializeLotoMultiplier
}; 