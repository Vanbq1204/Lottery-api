const Store = require('../models/Store');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const mongoose = require('mongoose');
const { getVietnamDayRange } = require('../utils/dateUtils');

// Lấy danh sách cửa hàng của admin
const getMyStores = async (req, res) => {
  try {
    const adminId = req.user.id;
    
    // Tìm các cửa hàng mà admin này quản lý
    const stores = await Store.find({ adminId: adminId });
    
    // Lấy thông tin nhân viên cho mỗi cửa hàng
    const storesWithEmployees = await Promise.all(
      stores.map(async (store) => {
        // Tìm nhân viên thuộc cửa hàng này
        const employees = await User.find({ 
          storeId: store._id,
          role: 'employee' 
        }).select('name username');
        
        return {
          _id: store._id,
          name: store.name,
          address: store.address,
          phone: store.phone,
          employees: employees,
          createdAt: store.createdAt
        };
      })
    );
    
    res.json({
      success: true,
      stores: storesWithEmployees
    });
    
  } catch (error) {
    console.error('Lỗi lấy danh sách cửa hàng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách cửa hàng'
    });
  }
};

// Lấy chi tiết một cửa hàng
const getStoreDetail = async (req, res) => {
  try {
    const { storeId } = req.params;
    const adminId = req.user.id;
    
    // Kiểm tra admin có quyền truy cập cửa hàng này không
    const store = await Store.findOne({ 
      _id: storeId, 
      adminId: adminId 
    });
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cửa hàng hoặc bạn không có quyền truy cập'
      });
    }
    
    // Lấy thông tin nhân viên
    const employees = await User.find({ 
      storeId: store._id,
      role: 'employee' 
    }).select('name username email phone createdAt');
    
    res.json({
      success: true,
      store: {
        _id: store._id,
        name: store.name,
        address: store.address,
        phone: store.phone,
        employees: employees,
        createdAt: store.createdAt
      }
    });
    
  } catch (error) {
    console.error('Lỗi lấy chi tiết cửa hàng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết cửa hàng'
    });
  }
};

// Lấy thống kê cửa hàng theo ngày
const getStoreStatistics = async (req, res) => {
  try {
    const { storeId, date } = req.query;
    const adminId = req.user.id;
    
    if (!storeId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp storeId và date'
      });
    }

    // Kiểm tra quyền admin với cửa hàng này
    const store = await Store.findOne({ 
      _id: new mongoose.Types.ObjectId(storeId),
      adminId: new mongoose.Types.ObjectId(adminId)
    });

    if (!store) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập cửa hàng này'
      });
    }

    // Tạo date range với múi giờ Việt Nam
    const { startOfDay, endOfDay } = getVietnamDayRange(date);

    // Lấy tất cả hóa đơn trong ngày của cửa hàng
    const invoices = await Invoice.find({
      storeId: new mongoose.Types.ObjectId(storeId),
      printedAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    // Initialize stats object
    const stats = {
      totalRevenue: 0,
      lotoTotal: 0,
      '2sTotal': 0,
      '3sTotal': 0,
      '4sTotal': 0,
      tongTotal: 0,
      kepTotal: 0,
      dauTotal: 0,
      ditTotal: 0,
      boTotal: 0,
      tongKepDauDitBoTotal: 0, // Tổng tiền khách trả cho nhóm tổng/kép/đầu/đít/bộ
      xienTotal: 0,
      xienquayTotal: 0,
      loto: {}, // Will store loto numbers and their points
      '2s': {},
      '3s': {},
      '4s': {},
      tong: {},
      kep: {},
      dau: {},
      dit: {},
      bo: {},
      xien: {},
      xienquay: {}
    };

    // Process each invoice
    invoices.forEach(invoice => {
      if (invoice.items && Array.isArray(invoice.items)) {
        invoice.items.forEach(item => {
          // Sử dụng totalAmount của từng item cho tổng tiền khách trả
          const betAmount = (item.totalAmount || 0);
          stats.totalRevenue += betAmount;

          switch (item.betType) {
            case 'loto':
              stats.lotoTotal += betAmount;
              if (item.numbers) {
                const numbers = item.numbers.split(',').map(n => n.trim());
                const pointsPerNumber = item.points || 0;
                numbers.forEach(num => {
                  stats.loto[num] = (stats.loto[num] || 0) + pointsPerNumber;
                });
              }
              break;

            case '2s':
              stats['2sTotal'] += betAmount;
              if (item.numbers) {
                const numbers = item.numbers.split(',').map(n => n.trim());
                const amountPerNumber = item.amount || 0;
                numbers.forEach(num => {
                  stats['2s'][num] = (stats['2s'][num] || 0) + amountPerNumber;
                });
              }
              break;

            case '3s':
              stats['3sTotal'] += betAmount;
              if (item.numbers) {
                const numbers = item.numbers.split(',').map(n => n.trim());
                const amountPerNumber = item.amount || 0;
                numbers.forEach(num => {
                  stats['3s'][num] = (stats['3s'][num] || 0) + amountPerNumber;
                });
              }
              break;

            case '4s':
              stats['4sTotal'] += betAmount;
              if (item.numbers) {
                const numbers = item.numbers.split(',').map(n => n.trim());
                const amountPerNumber = item.amount || 0;
                numbers.forEach(num => {
                  stats['4s'][num] = (stats['4s'][num] || 0) + amountPerNumber;
                });
              }
              break;

            case 'tong':
              // Sử dụng totalAmount (số tiền khách trả) thay vì amount
              const tongBetAmount = item.totalAmount || 0;
              stats.tongTotal += tongBetAmount;
              // Cộng tổng tiền khách trả cho nhóm tổng/kép/đầu/đít/bộ
              stats.tongKepDauDitBoTotal += betAmount;
              if (item.numbers) {
                const numbers = item.numbers.split(',').map(n => n.trim());
                const amountPerNumber = item.amount || 0;
                numbers.forEach(num => {
                  stats.tong[num] = (stats.tong[num] || 0) + amountPerNumber;
                });
              }
              break;

            case 'kep':
              // Sử dụng totalAmount (số tiền khách trả) thay vì amount
              const kepBetAmount = item.totalAmount || 0;
              stats.kepTotal += kepBetAmount;
              // Cộng tổng tiền khách trả cho nhóm tổng/kép/đầu/đít/bộ
              stats.tongKepDauDitBoTotal += betAmount;
              if (item.numbers) {
                const numbers = item.numbers.split(',').map(n => n.trim());
                const amountPerNumber = item.amount || 0;
                numbers.forEach(num => {
                  stats.kep[num] = (stats.kep[num] || 0) + amountPerNumber;
                });
              }
              break;

            case 'dau':
              // Sử dụng totalAmount (số tiền khách trả) thay vì amount
              const dauBetAmount = item.totalAmount || 0;
              stats.dauTotal += dauBetAmount;
              // Cộng tổng tiền khách trả cho nhóm tổng/kép/đầu/đít/bộ
              stats.tongKepDauDitBoTotal += betAmount;
              if (item.numbers) {
                const numbers = item.numbers.split(',').map(n => n.trim());
                const amountPerNumber = item.amount || 0;
                numbers.forEach(num => {
                  stats.dau[num] = (stats.dau[num] || 0) + amountPerNumber;
                });
              }
              break;

            case 'dit':
              // Sử dụng totalAmount (số tiền khách trả) thay vì amount
              const ditBetAmount = item.totalAmount || 0;
              stats.ditTotal += ditBetAmount;
              // Cộng tổng tiền khách trả cho nhóm tổng/kép/đầu/đít/bộ
              stats.tongKepDauDitBoTotal += betAmount;
              if (item.numbers) {
                const numbers = item.numbers.split(',').map(n => n.trim());
                const amountPerNumber = item.amount || 0;
                numbers.forEach(num => {
                  stats.dit[num] = (stats.dit[num] || 0) + amountPerNumber;
                });
              }
              break;

            case 'bo':
              // Sử dụng totalAmount (số tiền khách trả) thay vì amount
              const boBetAmount = item.totalAmount || 0;
              stats.boTotal += boBetAmount;
              // Cộng tổng tiền khách trả cho nhóm tổng/kép/đầu/đít/bộ
              stats.tongKepDauDitBoTotal += betAmount;
              if (item.numbers) {
                // Với cấu trúc mới, item.numbers chứa tên bộ (ví dụ: "05 06 07")
                const boNumbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
                const amountPerNumber = item.amount || 0;
                boNumbers.forEach(boName => {
                  // Đảm bảo format 2 chữ số
                  const boNumber = boName.padStart(2, '0');
                  stats.bo[boNumber] = (stats.bo[boNumber] || 0) + amountPerNumber;
                });
              }
              break;

            case 'xien':
            case 'xien2':
            case 'xien3':
            case 'xien4':
              stats.xienTotal += betAmount;
              if (item.numbers) {
                const amountPerNumber = item.amount || 0;
                // Tách từng con xiên riêng biệt
                const xienNumbers = item.numbers.split(',').map(n => n.trim());
                xienNumbers.forEach(xienNum => {
                  if (xienNum) {
                    stats.xien[xienNum] = (stats.xien[xienNum] || 0) + amountPerNumber;
                  }
                });
              }
              break;

            case 'xienquay':
            case 'xienquay3':
            case 'xienquay4':
              stats.xienquayTotal += betAmount;
              if (item.numbers) {
                const amountPerNumber = item.amount || 0;
                // Tách từng con xiên quay riêng biệt
                const xienquayNumbers = item.numbers.split(',').map(n => n.trim());
                xienquayNumbers.forEach(xienquayNum => {
                  if (xienquayNum) {
                    stats.xienquay[xienquayNum] = (stats.xienquay[xienquayNum] || 0) + amountPerNumber;
                  }
                });
              }
              break;
          }
        });
      }
    });

    res.json({
      success: true,
      date: date,
      storeId: storeId,
      storeName: store.name,
      totalInvoices: invoices.length,
      stats: stats
    });

  } catch (error) {
    console.error('Lỗi thống kê cửa hàng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi thống kê cửa hàng'
    });
  }
};

module.exports = {
  getMyStores,
  getStoreDetail,
  getStoreStatistics
};