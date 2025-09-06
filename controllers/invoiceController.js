const Invoice = require('../models/Invoice');
const InvoiceHistory = require('../models/InvoiceHistory');
const Store = require('../models/Store');
const User = require('../models/User');
const { getVietnamDayRange } = require('../utils/dateUtils');

// Lưu hóa đơn mới
const saveInvoice = async (req, res) => {
  try {
    const {
      invoiceId,
      customerName,
      items,
      totalAmount,
      customerPaid,
      changeAmount
    } = req.body;

    // Kiểm tra tính duy nhất của mã hóa đơn
    const existingInvoice = await Invoice.findOne({ invoiceId });
    if (existingInvoice) {
      return res.status(400).json({ 
        success: false, 
        message: `Mã hóa đơn ${invoiceId} đã tồn tại. Vui lòng tạo mã mới.` 
      });
    }

    // Lấy thông tin user từ token
    const employeeId = req.user.id;
    const employee = await User.findById(employeeId);
    
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên' });
    }

    // Lấy thông tin store và admin
    const store = await Store.findById(employee.storeId).populate('adminId');
    if (!store) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng' });
    }

    // Tạo hóa đơn mới
    const newInvoice = new Invoice({
      invoiceId,
      customerName: customerName || 'Khách lẻ',
      storeId: store._id,
      adminId: store.adminId._id,
      employeeId: employeeId,
      items,
      totalAmount,
      customerPaid,
      changeAmount,
      printedAt: new Date()
    });

    const savedInvoice = await newInvoice.save();

    res.json({
      success: true,
      message: 'Lưu hóa đơn thành công',
      invoice: savedInvoice
    });

  } catch (error) {
    console.error('Save invoice error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000 && error.keyPattern?.invoiceId) {
      return res.status(400).json({
        success: false,
        message: 'Mã hóa đơn đã tồn tại. Vui lòng tạo mã mới.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lưu hóa đơn',
      error: error.message
    });
  }
};

// Lấy danh sách hóa đơn theo store
const getInvoicesByStore = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const employee = await User.findById(employeeId);
    
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên' });
    }

    const { page = 1, limit = 20, startDate, endDate } = req.query;
    
    // Build query
    const query = { storeId: employee.storeId };
    
    if (startDate || endDate) {
      query.printedAt = {};
      
      if (startDate) {
        // Create Vietnam timezone range for the date
        const startOfDay = new Date(startDate + 'T00:00:00+07:00');
        query.printedAt.$gte = startOfDay;
      }
      
      if (endDate) {
        // Create Vietnam timezone range for the date
        const endOfDay = new Date(endDate + 'T23:59:59.999+07:00');
        query.printedAt.$lte = endOfDay;
      }
    }

    const invoices = await Invoice.find(query)
      .populate('employeeId', 'name username')
      .sort({ printedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Invoice.countDocuments(query);

    res.json({
      success: true,
      invoices,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách hóa đơn',
      error: error.message
    });
  }
};

// Lấy danh sách hóa đơn theo admin (cho admin xem tất cả cửa hàng)
const getInvoicesByAdmin = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { page = 1, limit = 20, storeId, startDate, endDate } = req.query;
    
    // Build query
    const query = { adminId };
    
    if (storeId) {
      query.storeId = storeId;
    }
    
    if (startDate || endDate) {
      query.printedAt = {};
      
      if (startDate) {
        // Create Vietnam timezone range for the date
        const startOfDay = new Date(startDate + 'T00:00:00+07:00');
        query.printedAt.$gte = startOfDay;
      }
      
      if (endDate) {
        // Create Vietnam timezone range for the date
        const endOfDay = new Date(endDate + 'T23:59:59.999+07:00');
        query.printedAt.$lte = endOfDay;
      }
    }

    const invoices = await Invoice.find(query)
      .populate('storeId', 'name address')
      .populate('employeeId', 'name username')
      .sort({ printedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Invoice.countDocuments(query);

    res.json({
      success: true,
      invoices,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Get invoices by admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách hóa đơn',
      error: error.message
    });
  }
};

// Lấy chi tiết hóa đơn
const getInvoiceDetail = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    
    const invoice = await Invoice.findOne({ invoiceId })
      .populate('storeId', 'name address phone')
      .populate('adminId', 'name email')
      .populate('employeeId', 'name username');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    }

    // Check permission
    const userId = req.user.id;
    const userRole = req.user.role;
    
    if (userRole === 'employee' && invoice.employeeId._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Không có quyền xem hóa đơn này' });
    }
    
    if (userRole === 'admin' && invoice.adminId._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Không có quyền xem hóa đơn này' });
    }

    res.json({
      success: true,
      invoice
    });

  } catch (error) {
    console.error('Get invoice detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết hóa đơn',
      error: error.message
    });
  }
};

// Thống kê hóa đơn chi tiết
const getInvoiceStats = async (req, res) => {
  try {
    const { date } = req.query;
    const user = req.user;
    const { getLotoMultiplierByStoreId } = require('./lotoMultiplierController');
    
    // Build date query với múi giờ Việt Nam
    let dateQuery = {};
    if (date) {
      const { startOfDay, endOfDay } = getVietnamDayRange(date);
      dateQuery.printedAt = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }
    
    // Build store query based on user role
    let storeQuery = {};
    if (user.role === 'admin') {
      const stores = await Store.find({ adminId: user._id });
      const storeIds = stores.map(store => store._id);
      storeQuery.storeId = { $in: storeIds };
    } else {
      storeQuery.storeId = user.storeId;
    }
    
    const query = { ...dateQuery, ...storeQuery };

    // Get all invoices for the date and store
    const invoices = await Invoice.find(query);

    // Initialize stats object
    const stats = {
      totalRevenue: 0,
      lotoTotal: 0,
      '2sTotal': 0,
      '3sTotal': 0,
      tongTotal: 0,
      kepTotal: 0,
      dauTotal: 0,
      ditTotal: 0,
      boTotal: 0,
      xienTotal: 0,
      xienquayTotal: 0,
      loto: {}, // Will store loto numbers and their points
      '2s': {}, // Will store 2s numbers and their amounts
      '3s': {}, // Will store 3s numbers and their amounts
      tong: {}, // Will store tong numbers and their amounts
      kep: {}, // Will store kep types and their amounts
      dau: {}, // Will store dau numbers and their amounts
      dit: {}, // Will store dit numbers and their amounts
      bo: {}, // Will store bo numbers and their amounts
      xien: {}, // Will store xien combinations and their amounts
      xienquay: {} // Will store xienquay combinations and their amounts
    };

    // Process each invoice
    invoices.forEach(invoice => {
      stats.totalRevenue += invoice.totalAmount;

      // Process each item in the invoice
      invoice.items.forEach(item => {
        const betType = item.betType;
        const amount = item.totalAmount || 0;

        // Add to bet type totals
        switch(betType) {
          case 'loto':
            stats.lotoTotal += amount;
            // Process loto numbers and points
            if (item.numbers && item.points) {
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const points = parseInt(item.points) || 0;
              
              numbers.forEach(num => {
                const paddedNum = num.padStart(2, '0');
                if (!stats.loto[paddedNum]) {
                  stats.loto[paddedNum] = 0;
                }
                stats.loto[paddedNum] += points;
              });
            }
            break;
          case '2s':
            stats['2sTotal'] += amount;
            // Process 2s numbers and amounts
            if (item.numbers && item.amount) {
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmount = parseInt(item.amount) || 0;
              
              numbers.forEach(num => {
                const paddedNum = num.padStart(2, '0');
                if (!stats['2s'][paddedNum]) {
                  stats['2s'][paddedNum] = 0;
                }
                stats['2s'][paddedNum] += betAmount;
              });
            }
            break;
          case '3s':
            stats['3sTotal'] += amount;
            // Process 3s numbers and amounts
            if (item.numbers && item.amount) {
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmount = parseInt(item.amount) || 0;
              
              numbers.forEach(num => {
                const paddedNum = num.padStart(3, '0');
                if (!stats['3s'][paddedNum]) {
                  stats['3s'][paddedNum] = 0;
                }
                stats['3s'][paddedNum] += betAmount;
              });
            }
            break;
          case 'tong':
            stats.tongTotal += amount;
            // Process tong numbers and amounts
            if (item.numbers && item.amount) {
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmount = parseInt(item.amount) || 0;
              
              numbers.forEach(num => {
                // Clean tong number (remove "tổng" prefix if exists)
                const cleanNum = num.toLowerCase().replace(/^tổng\s*/, '');
                if (!stats.tong[cleanNum]) {
                  stats.tong[cleanNum] = 0;
                }
                stats.tong[cleanNum] += betAmount;
              });
            }
            break;
          case 'kep':
            stats.kepTotal += amount;
            // Process kep types and amounts
            if (item.numbers && item.amount) {
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmount = parseInt(item.amount) || 0;
              
              numbers.forEach(num => {
                const cleanNum = num.toLowerCase().trim();
                if (!stats.kep[cleanNum]) {
                  stats.kep[cleanNum] = 0;
                }
                stats.kep[cleanNum] += betAmount;
              });
            }
            break;
          case 'dau':
            stats.dauTotal += amount;
            // Process dau numbers and amounts
            if (item.numbers && item.amount) {
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmount = parseInt(item.amount) || 0;
              
              numbers.forEach(num => {
                // Clean dau number (remove "đầu" prefix if exists)
                const cleanNum = num.toLowerCase().replace(/^đầu\s*/, '');
                if (!stats.dau[cleanNum]) {
                  stats.dau[cleanNum] = 0;
                }
                stats.dau[cleanNum] += betAmount;
              });
            }
            break;
          case 'dit':
            stats.ditTotal += amount;
            // Process dit numbers and amounts
            if (item.numbers && item.amount) {
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmount = parseInt(item.amount) || 0;
              
              numbers.forEach(num => {
                // Clean dit number (remove "đít" prefix if exists)
                const cleanNum = num.toLowerCase().replace(/^đít\s*/, '');
                if (!stats.dit[cleanNum]) {
                  stats.dit[cleanNum] = 0;
                }
                stats.dit[cleanNum] += betAmount;
              });
            }
            break;
          case 'bo':
            stats.boTotal += amount;
            // Process bo numbers and amounts
            if (item.numbers && item.amount) {
              // Với cấu trúc mới, item.numbers chứa tên bộ (ví dụ: "05 06 07")
              const boNumbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmount = parseInt(item.amount) || 0;
              
              boNumbers.forEach(boName => {
                // Đảm bảo format 2 chữ số
                const boNumber = boName.padStart(2, '0');
                if (!stats.bo[boNumber]) {
                  stats.bo[boNumber] = 0;
                }
                stats.bo[boNumber] += betAmount;
              });
            }
            break;
          case 'xien':
            stats.xienTotal += amount;
            // Process xien combinations and amounts
            if (item.numbers && item.amount) {
              const combinations = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmount = parseInt(item.amount) || 0;
              
              combinations.forEach(combo => {
                if (!stats.xien[combo]) {
                  stats.xien[combo] = 0;
                }
                stats.xien[combo] += betAmount;
              });
            }
            break;
          case 'xienquay':
            stats.xienquayTotal += amount;
            // Process xienquay combinations and amounts
            if (item.numbers && item.amount) {
              const combinations = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmount = parseInt(item.amount) || 0;
              
              combinations.forEach(combo => {
                if (!stats.xienquay[combo]) {
                  stats.xienquay[combo] = 0;
                }
                stats.xienquay[combo] += betAmount;
              });
            }
            break;
        }
      });
    });

    // Lấy hệ số lô cho cửa hàng
    const lotoMultiplier = await getLotoMultiplierByStoreId(user.storeId);

    res.json({
      success: true,
      stats: {
        ...stats,
        lotoMultiplier // Thêm hệ số lô vào response
      },
      totalInvoices: invoices.length,
      date: date || 'Tất cả'
    });

  } catch (error) {
    console.error('Get invoice stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê hóa đơn',
      error: error.message
    });
  }
};

// Sửa hóa đơn
const editInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const {
      customerName,
      items,
      totalAmount,
      customerPaid,
      changeAmount,
      reason
    } = req.body;

    const employeeId = req.user.id;
    const employee = await User.findById(employeeId);
    
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên' });
    }

    // Tìm hóa đơn cần sửa
    const existingInvoice = await Invoice.findOne({ invoiceId });
    if (!existingInvoice) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    }

    // Kiểm tra quyền sửa (chỉ cùng store)
    if (existingInvoice.storeId.toString() !== employee.storeId.toString()) {
      return res.status(403).json({ success: false, message: 'Không có quyền sửa hóa đơn này' });
    }

    // Lưu dữ liệu cũ để so sánh
    const oldData = {
      customerName: existingInvoice.customerName,
      items: existingInvoice.items,
      totalAmount: existingInvoice.totalAmount,
      customerPaid: existingInvoice.customerPaid,
      changeAmount: existingInvoice.changeAmount
    };

    // Cập nhật hóa đơn
    existingInvoice.customerName = customerName || existingInvoice.customerName;
    existingInvoice.items = items || existingInvoice.items;
    existingInvoice.totalAmount = totalAmount || existingInvoice.totalAmount;
    existingInvoice.customerPaid = customerPaid || existingInvoice.customerPaid;
    existingInvoice.changeAmount = changeAmount || existingInvoice.changeAmount;

    const updatedInvoice = await existingInvoice.save();

    // Lưu lịch sử sửa đổi
    const newData = {
      customerName: updatedInvoice.customerName,
      items: updatedInvoice.items,
      totalAmount: updatedInvoice.totalAmount,
      customerPaid: updatedInvoice.customerPaid,
      changeAmount: updatedInvoice.changeAmount
    };

    // Tính toán thay đổi
    const changes = {};
    if (oldData.customerName !== newData.customerName) {
      changes.customerName = { from: oldData.customerName, to: newData.customerName };
    }
    if (oldData.totalAmount !== newData.totalAmount) {
      changes.totalAmount = { from: oldData.totalAmount, to: newData.totalAmount };
    }
    if (oldData.customerPaid !== newData.customerPaid) {
      changes.customerPaid = { from: oldData.customerPaid, to: newData.customerPaid };
    }
    if (oldData.changeAmount !== newData.changeAmount) {
      changes.changeAmount = { from: oldData.changeAmount, to: newData.changeAmount };
    }
    if (JSON.stringify(oldData.items) !== JSON.stringify(newData.items)) {
      changes.items = { from: oldData.items, to: newData.items };
    }

    // Tạo lịch sử
    const history = new InvoiceHistory({
      invoiceId,
      originalInvoiceId: existingInvoice._id,
      action: 'edit',
      employeeId,
      storeId: employee.storeId,
      adminId: existingInvoice.adminId,
      changes,
      oldData,
      newData,
      reason: reason || 'Sửa đổi hóa đơn'
    });

    await history.save();

    res.json({
      success: true,
      message: 'Sửa hóa đơn thành công',
      invoice: updatedInvoice
    });

  } catch (error) {
    console.error('Edit invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi sửa hóa đơn',
      error: error.message
    });
  }
};

// Xóa hóa đơn
const deleteInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { reason } = req.body;

    const employeeId = req.user.id;
    const employee = await User.findById(employeeId);
    
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên' });
    }

    // Tìm hóa đơn cần xóa
    const existingInvoice = await Invoice.findOne({ invoiceId });
    if (!existingInvoice) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    }

    // Kiểm tra quyền xóa (chỉ cùng store)
    if (existingInvoice.storeId.toString() !== employee.storeId.toString()) {
      return res.status(403).json({ success: false, message: 'Không có quyền xóa hóa đơn này' });
    }

    // Lưu dữ liệu cũ trước khi xóa
    const oldData = {
      customerName: existingInvoice.customerName,
      items: existingInvoice.items,
      totalAmount: existingInvoice.totalAmount,
      customerPaid: existingInvoice.customerPaid,
      changeAmount: existingInvoice.changeAmount,
      printedAt: existingInvoice.printedAt
    };

    // Tạo lịch sử xóa trước khi xóa hóa đơn
    const history = new InvoiceHistory({
      invoiceId,
      originalInvoiceId: existingInvoice._id,
      action: 'delete',
      employeeId,
      storeId: employee.storeId,
      adminId: existingInvoice.adminId,
      changes: { action: 'deleted' },
      oldData,
      newData: {},
      reason: reason || 'Xóa hóa đơn'
    });

    await history.save();

    // Xóa hóa đơn
    await Invoice.deleteOne({ invoiceId });

    res.json({
      success: true,
      message: 'Xóa hóa đơn thành công'
    });

  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa hóa đơn',
      error: error.message
    });
  }
};

// Lấy lịch sử sửa đổi hóa đơn
const getInvoiceHistory = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const employee = await User.findById(employeeId);
    
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên' });
    }

    const { page = 1, limit = 20, startDate, endDate, action } = req.query;
    
    // Build query
    const query = { storeId: employee.storeId };
    
    if (action) {
      query.action = action;
    }
    
    if (startDate || endDate) {
      query.actionDate = {};
      if (startDate) query.actionDate.$gte = new Date(startDate);
      if (endDate) query.actionDate.$lte = new Date(endDate);
    }

    const histories = await InvoiceHistory.find(query)
      .populate('employeeId', 'name username')
      .sort({ actionDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await InvoiceHistory.countDocuments(query);

    res.json({
      success: true,
      histories,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Get invoice history error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch sử hóa đơn',
      error: error.message
    });
  }
};

// Lấy chi tiết lịch sử theo ngày
const getHistoryByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const employeeId = req.user.id;
    const employee = await User.findById(employeeId);
    
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên' });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const histories = await InvoiceHistory.find({
      storeId: employee.storeId,
      actionDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    })
    .populate('employeeId', 'name username')
    .sort({ actionDate: -1 });

    res.json({
      success: true,
      date,
      histories
    });

  } catch (error) {
    console.error('Get history by date error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch sử theo ngày',
      error: error.message
    });
  }
};

const checkInvoiceExists = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const existingInvoice = await Invoice.findOne({ invoiceId });
    res.json({ exists: !!existingInvoice });
  } catch (error) {
    console.error('Check invoice existence error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi kiểm tra mã hóa đơn',
      error: error.message
    });
  }
};

module.exports = {
  saveInvoice,
  getInvoicesByStore,
  getInvoicesByAdmin,
  getInvoiceDetail,
  getInvoiceStats,
  editInvoice,
  deleteInvoice,
  getInvoiceHistory,
  getHistoryByDate,
  checkInvoiceExists
};