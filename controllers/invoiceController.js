const Invoice = require('../models/Invoice');
const InvoiceHistory = require('../models/InvoiceHistory');
const Store = require('../models/Store');
const User = require('../models/User');
const TimeSettings = require('../models/TimeSettings');
const { getVietnamDayRange, getCurrentVietnamTime, isBeforeCutoffTime } = require('../utils/dateUtils');
const MessageExportSnapshot = require('../models/MessageExportSnapshot');

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

    // Lấy cài đặt thời gian để kiểm tra validation
    const timeSettings = await TimeSettings.findOne({ adminId: store.adminId._id });

    // Kiểm tra thời gian cho lô, xiên, xiên quay
    const specialBetTypes = ['loto', 'xien', 'xienquay'];

    if (timeSettings && timeSettings.specialBetsLimitActive) {
      // Kiểm tra xem có item nào thuộc loại special bet types không
      const hasSpecialBets = items.some(item => specialBetTypes.includes(item.betType));

      if (hasSpecialBets) {
        const allowed = isBeforeCutoffTime(timeSettings.specialBetsCutoffTime);
        if (!allowed) {
          const currentTime = getCurrentVietnamTime();
          return res.status(403).json({
            success: false,
            message: `Không thể lưu hóa đơn vì có cược lô, xiên, xiên quay đã quá thời gian quy định (${timeSettings.specialBetsCutoffTime}). Hiện tại: ${currentTime}`,
            cutoffTime: timeSettings.specialBetsCutoffTime,
            currentTime: currentTime,
            code: 'SPECIAL_BETS_TIME_EXPIRED'
          });
        }
      }
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
    console.log('✅ Invoice saved:', savedInvoice.invoiceId);

    // Socket.io emit
    const io = req.app.get('socketio');
    console.log('🔌 Socket.io instance:', io ? 'Found' : 'NOT FOUND');

    if (io) {
      // Convert invoice to plain object with storeId as string for easier comparison
      const invoicePayload = {
        ...savedInvoice.toObject(),
        storeId: savedInvoice.storeId.toString(),
        adminId: savedInvoice.adminId.toString()
      };

      const storeRoom = store._id.toString();
      const adminRoom = store.adminId._id.toString();

      console.log('📤 Emitting new_invoice to rooms:', { storeRoom, adminRoom });

      // Notify store room
      io.to(storeRoom).emit('new_invoice', {
        message: `Hóa đơn mới từ ${savedInvoice.customerName}`,
        invoice: invoicePayload
      });
      console.log('✅ Emitted to store room:', storeRoom);

      // Notify admin room
      io.to(adminRoom).emit('new_invoice', {
        message: `Hóa đơn mới từ ${store.name} - ${savedInvoice.customerName}`,
        invoice: invoicePayload
      });
      console.log('✅ Emitted to admin room:', adminRoom);
    } else {
      console.error('❌ Socket.io not available!');
    }

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
      loATotal: 0,
      '3sTotal': 0,
      '4sTotal': 0,
      tongTotal: 0,
      kepTotal: 0,
      dauTotal: 0,
      ditTotal: 0,
      deaATotal: 0,
      dauATotal: 0,
      ditATotal: 0,
      boTotal: 0,
      xienTotal: 0,
      xienquayTotal: 0,
      loto: {}, // Will store loto numbers and their points
      '2s': {}, // Will store 2s numbers and their amounts
      loA: {}, // Will store Lo A numbers and their points
      '3s': {}, // Will store 3s numbers and their amounts
      '4s': {}, // Will store 4s numbers and their amounts
      tong: {}, // Will store tong numbers and their amounts
      kep: {}, // Will store kep types and their amounts
      dau: {}, // Will store dau numbers and their amounts
      dit: {}, // Will store dit numbers and their amounts
      deaA: {}, // Đề A (2 số)
      dauA: {}, // Đề Đầu A (1 số)
      ditA: {}, // Đề Đít A (1 số)
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
      switch (betType) {
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
        case 'loA':
          stats.loATotal = (stats.loATotal || 0) + amount;
          // Process Lô A numbers and points (same as loto)
          if (item.numbers && item.points) {
            const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
            const points = parseInt(item.points) || 0;

            numbers.forEach(num => {
              const paddedNum = num.padStart(2, '0');
              stats.loA = stats.loA || {};
              if (!stats.loA[paddedNum]) {
                stats.loA[paddedNum] = 0;
              }
              stats.loA[paddedNum] += points;
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
          case '4s':
            stats['4sTotal'] += amount;
            // Process 4s numbers and amounts
            if (item.numbers && item.amount) {
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmount = parseInt(item.amount) || 0;

              numbers.forEach(num => {
                const paddedNum = num.padStart(4, '0');
                if (!stats['4s'][paddedNum]) {
                  stats['4s'][paddedNum] = 0;
                }
                stats['4s'][paddedNum] += betAmount;
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
          case 'deaA':
            stats.deaATotal += amount;
            // Đề A (2 số) giống 2s
            if (item.numbers && item.amount) {
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmount = parseInt(item.amount) || 0;

              numbers.forEach(num => {
                const paddedNum = num.padStart(2, '0');
                if (!stats.deaA[paddedNum]) {
                  stats.deaA[paddedNum] = 0;
                }
                stats.deaA[paddedNum] += betAmount;
              });
            }
            break;
          case 'dauA':
            stats.dauATotal += amount;
            if (item.numbers && item.amount) {
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmount = parseInt(item.amount) || 0;

              numbers.forEach(num => {
                const cleanNum = num.toLowerCase().replace(/^đầu\s*/, '');
                if (!stats.dauA[cleanNum]) {
                  stats.dauA[cleanNum] = 0;
                }
                stats.dauA[cleanNum] += betAmount;
              });
            }
            break;
          case 'ditA':
            stats.ditATotal += amount;
            if (item.numbers && item.amount) {
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmount = parseInt(item.amount) || 0;

              numbers.forEach(num => {
                const cleanNum = num.toLowerCase().replace(/^đít\s*/, '');
                if (!stats.ditA[cleanNum]) {
                  stats.ditA[cleanNum] = 0;
                }
                stats.ditA[cleanNum] += betAmount;
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
            // Apply 1.2x multiplier for xiên nháy when calculating total
            const xienAmount = item.isXienNhay ? amount * 1.2 : amount;
            stats.xienTotal += xienAmount;
            // Process xien combinations and amounts
            if (item.numbers && item.amount) {
              const combinations = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmount = parseInt(item.amount) || 0;

              combinations.forEach(combo => {
                // Add (xiên nháy) suffix if isXienNhay is true
                const displayCombo = item.isXienNhay ? `${combo} (xiên nháy)` : combo;
                if (!stats.xien[displayCombo]) {
                  stats.xien[displayCombo] = 0;
                }
                stats.xien[displayCombo] += betAmount;
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
      reason,
      locationAddress
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

    // Khóa sửa nếu hóa đơn đã nằm trong phạm vi lần xuất tin nhắn của admin
    const lockedSnapshot = await MessageExportSnapshot.findOne({
      adminId: existingInvoice.adminId,
      startTime: { $lte: existingInvoice.printedAt },
      endTime: { $gte: existingInvoice.printedAt }
    });
    if (lockedSnapshot) {
      // Cho phép nếu admin đã duyệt yêu cầu
      const InvoiceChangeRequest = require('../models/InvoiceChangeRequest');
      const approvedReq = await InvoiceChangeRequest.findOne({ invoiceId: existingInvoice.invoiceId, status: 'approved' });
      if (approvedReq) {
        // continue to edit
      } else {
        return res.status(403).json({
          success: false,
          code: 'INVOICE_LOCKED_BY_MESSAGE_EXPORT',
          message: `Hóa đơn đã được xuất tin nhắn (Lần ${lockedSnapshot.sequence} ngày ${lockedSnapshot.date}). Không thể sửa.`
        });
      }
    }

    // Lưu dữ liệu cũ để so sánh
    const oldData = {
      customerName: existingInvoice.customerName,
      items: existingInvoice.items,
      totalAmount: existingInvoice.totalAmount,
      customerPaid: existingInvoice.customerPaid,
      changeAmount: existingInvoice.changeAmount
    };

    // Chuẩn hóa items trước khi lưu: tính lại totalAmount cho Lô/Lô A theo hệ số cửa hàng
    let normalizedItems = items || existingInvoice.items;
    try {
      const { getLotoMultiplierByStoreId } = require('./lotoMultiplierController');
      const lotoMultiplier = await getLotoMultiplierByStoreId(existingInvoice.storeId);
      if (Array.isArray(normalizedItems)) {
        normalizedItems = normalizedItems.map(it => {
          if (it && (it.betType === 'loto' || it.betType === 'loA')) {
            const points = parseFloat(it.points) || 0;
            const nums = (it.numbers || '').split(/[\s,]+/).filter(n => n.length > 0);
            const count = nums.length;
            const computed = Math.round(points * count * (parseFloat(lotoMultiplier) || 0));
            return { ...it, totalAmount: computed };
          }
          return it;
        });
      }
    } catch (_) { /* giữ nguyên nếu lỗi */ }

    // Tính lại tổng tiền hóa đơn nếu không truyền vào
    const recomputedTotal = Array.isArray(normalizedItems)
      ? normalizedItems.reduce((sum, it) => sum + (parseFloat(it?.totalAmount) || 0), 0)
      : (totalAmount || existingInvoice.totalAmount);

    // Cập nhật hóa đơn
    existingInvoice.customerName = customerName || existingInvoice.customerName;
    existingInvoice.items = normalizedItems;
    existingInvoice.totalAmount = (typeof totalAmount === 'number') ? totalAmount : recomputedTotal;
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
      newData,
      reason: reason || 'Sửa đổi hóa đơn',
      locationAddress: locationAddress || ''
    });

    await history.save();

    // Socket.io emit for edit event
    const io = req.app.get('socketio');
    if (io) {
      const invoicePayload = {
        ...updatedInvoice.toObject(),
        storeId: updatedInvoice.storeId.toString(),
        adminId: updatedInvoice.adminId.toString()
      };

      const storeRoom = employee.storeId.toString();
      const adminRoom = updatedInvoice.adminId.toString();

      console.log('📤 Emitting edit_invoice to rooms:', { storeRoom, adminRoom });

      // Notify store room
      io.to(storeRoom).emit('edit_invoice', {
        message: `Hóa đơn ${invoiceId} đã được sửa`,
        invoice: invoicePayload
      });

      // Notify admin room
      io.to(adminRoom).emit('edit_invoice', {
        message: `Hóa đơn ${invoiceId} đã được sửa`,
        invoice: invoicePayload
      });

      console.log('✅ Emitted edit_invoice events');
    }

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
    const { reason, locationAddress } = req.body;

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

    // Khóa xóa nếu hóa đơn đã nằm trong phạm vi lần xuất tin nhắn của admin
    const lockedSnapshot = await MessageExportSnapshot.findOne({
      adminId: existingInvoice.adminId,
      startTime: { $lte: existingInvoice.printedAt },
      endTime: { $gte: existingInvoice.printedAt }
    });
    const adminUser = await User.findById(existingInvoice.adminId);
    const mustRequireApproval = Boolean(lockedSnapshot) || Boolean(adminUser?.enforceDeleteApproval);
    if (mustRequireApproval) {
      const InvoiceChangeRequest = require('../models/InvoiceChangeRequest');
      const approvedReq = await InvoiceChangeRequest.findOne({ invoiceId: existingInvoice.invoiceId, status: 'approved' });
      if (!approvedReq) {
        const message = lockedSnapshot
          ? `Hóa đơn đã được xuất tin nhắn (Lần ${lockedSnapshot.sequence} ngày ${lockedSnapshot.date}). Không thể xóa nếu chưa có duyệt.`
          : 'Hóa đơn yêu cầu quyền admin để xóa. Vui lòng tạo yêu cầu và chờ admin duyệt.';
        return res.status(403).json({ success: false, code: 'INVOICE_DELETE_REQUIRES_APPROVAL', message });
      }
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
      reason: reason || 'Xóa hóa đơn',
      locationAddress: locationAddress || ''
    });

    await history.save();

    // Xóa hóa đơn
    await Invoice.deleteOne({ invoiceId });

    // Socket.io emit for delete event
    const io = req.app.get('socketio');
    if (io) {
      const deletePayload = {
        invoiceId,
        storeId: employee.storeId.toString(),
        adminId: existingInvoice.adminId.toString()
      };

      const storeRoom = employee.storeId.toString();
      const adminRoom = existingInvoice.adminId.toString();

      console.log('📤 Emitting delete_invoice to rooms:', { storeRoom, adminRoom });

      // Notify store room
      io.to(storeRoom).emit('delete_invoice', {
        message: `Hóa đơn ${invoiceId} đã được xóa`,
        data: deletePayload
      });

      // Notify admin room
      io.to(adminRoom).emit('delete_invoice', {
        message: `Hóa đơn ${invoiceId} đã được xóa`,
        data: deletePayload
      });

      console.log('✅ Emitted delete_invoice events');
    }

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
