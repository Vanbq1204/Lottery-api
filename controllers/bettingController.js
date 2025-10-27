const Betting = require('../models/Betting');
const Store = require('../models/Store');
const User = require('../models/User');
const TimeSettings = require('../models/TimeSettings');
const { getCurrentVietnamTime, isBeforeCutoffTime } = require('../utils/dateUtils');

// Gửi cược
const submitBets = async (req, res) => {
  try {
    const { bets, totalAmount } = req.body;
    const employeeId = req.user._id;

    // Kiểm tra input
    if (!bets || !Array.isArray(bets) || bets.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Danh sách cược không hợp lệ'
      });
    }

    // Kiểm tra quyền (chỉ employee mới được nhập cược)
    if (req.user.role !== 'employee') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ nhân viên mới được nhập cược'
      });
    }

    // Lấy thông tin store
    const store = await Store.findById(req.user.storeId);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cửa hàng'
      });
    }

    // Lấy cài đặt thời gian của admin để kiểm tra giới hạn cho lô, xiên, xiên quay
    const timeSettings = await TimeSettings.findOne({ adminId: store.adminId });

    // Chuẩn bị dữ liệu cược
    const bettingRecords = [];
    let calculatedTotal = 0;
    const specialBetTypes = ['lo2so', 'lo3so', 'lo4so', 'xien2', 'xien3', 'xien4', 'xiendau', 'xienduoi', 'xiendacbiet', 'xiengiai1', 'xiengiai2', 'xiengiai3', 'xiengiai4', 'xiengiai5', 'xiengiai6', 'xiengiai7', 'xienquay'];

    for (const bet of bets) {
      // Validate từng cược
      if (!bet.betType || !bet.numbers || !bet.amount || !bet.province) {
        return res.status(400).json({
          success: false,
          message: 'Thông tin cược không đầy đủ'
        });
      }

      if (bet.amount < 1000) {
        return res.status(400).json({
          success: false,
          message: 'Số tiền cược tối thiểu là 1,000 VNĐ'
        });
      }

      // Kiểm tra thời gian cho lô, xiên, xiên quay
      if (timeSettings && timeSettings.specialBetsLimitActive && specialBetTypes.includes(bet.betType)) {
        const allowed = isBeforeCutoffTime(timeSettings.specialBetsCutoffTime);
        if (!allowed) {
          const currentTime = getCurrentVietnamTime();
          return res.status(403).json({
            success: false,
            message: `Không thể nhập cược ${bet.betType} vì đã quá thời gian quy định (${timeSettings.specialBetsCutoffTime}). Hiện tại: ${currentTime}`,
            cutoffTime: timeSettings.specialBetsCutoffTime,
            currentTime: currentTime,
            code: 'SPECIAL_BETS_TIME_EXPIRED'
          });
        }
      }

      calculatedTotal += parseInt(bet.amount);

      const bettingRecord = {
        customerName: bet.customerName || '',
        customerPhone: bet.customerPhone || '',
        betType: bet.betType,
        numbers: bet.numbers,
        amount: parseInt(bet.amount),
        province: bet.province,
        employeeId: employeeId,
        storeId: store._id,
        adminId: store.adminId
      };

      bettingRecords.push(bettingRecord);
    }

    // Kiểm tra tổng tiền
    if (Math.abs(calculatedTotal - totalAmount) > 1) {
      return res.status(400).json({
        success: false,
        message: 'Tổng tiền không khớp'
      });
    }

    // Lưu tất cả cược vào database
    const savedBets = await Betting.insertMany(bettingRecords);

    // Cập nhật thống kê store
    store.totalBetsToday += savedBets.length;
    store.totalAmountToday += calculatedTotal;
    await store.save();

    res.json({
      success: true,
      message: `Đã lưu ${savedBets.length} cược thành công`,
      data: {
        betsCount: savedBets.length,
        totalAmount: calculatedTotal,
        bets: savedBets
      }
    });

  } catch (error) {
    console.error('Submit bets error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lưu cược'
    });
  }
};

// Lấy danh sách cược của nhân viên
const getEmployeeBets = async (req, res) => {
  try {
    const { page = 1, limit = 50, date } = req.query;
    const employeeId = req.user._id;

    // Tạo filter
    const filter = { employeeId };

    // Nếu có date, lọc theo ngày
    if (date) {
      const searchDate = new Date(date);
      const startDate = new Date(searchDate.setHours(0, 0, 0, 0));
      const endDate = new Date(searchDate.setHours(23, 59, 59, 999));
      
      filter.createdAt = {
        $gte: startDate,
        $lte: endDate
      };
    } else {
      // Mặc định lấy cược hôm nay
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));
      
      filter.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }

    const bets = await Betting.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('storeId', 'name');

    const total = await Betting.countDocuments(filter);
    const totalAmount = await Betting.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      data: {
        bets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        summary: {
          totalBets: total,
          totalAmount: totalAmount.length > 0 ? totalAmount[0].total : 0
        }
      }
    });

  } catch (error) {
    console.error('Get employee bets error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách cược'
    });
  }
};

// Thống kê cược theo store (cho admin)
const getStoreBets = async (req, res) => {
  try {
    const { storeId, date, page = 1, limit = 50 } = req.query;
    
    // Kiểm tra quyền
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền truy cập'
      });
    }

    // Tạo filter
    const filter = {};
    
    if (storeId) {
      filter.storeId = storeId;
    } else if (req.user.role === 'admin') {
      // Admin chỉ xem được cược của các store thuộc về mình
      filter.adminId = req.user._id;
    }

    // Filter theo ngày
    if (date) {
      const searchDate = new Date(date);
      const startDate = new Date(searchDate.setHours(0, 0, 0, 0));
      const endDate = new Date(searchDate.setHours(23, 59, 59, 999));
      
      filter.createdAt = {
        $gte: startDate,
        $lte: endDate
      };
    }

    const bets = await Betting.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('employeeId', 'name username')
      .populate('storeId', 'name address');

    const total = await Betting.countDocuments(filter);
    
    // Thống kê tổng hợp
    const summary = await Betting.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalBets: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          byBetType: {
            $push: {
              betType: '$betType',
              amount: '$amount'
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        bets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        summary: summary.length > 0 ? summary[0] : {
          totalBets: 0,
          totalAmount: 0,
          byBetType: []
        }
      }
    });

  } catch (error) {
    console.error('Get store bets error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê cược'
    });
  }
};

module.exports = {
  submitBets,
  getEmployeeBets,
  getStoreBets
};