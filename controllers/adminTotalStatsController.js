const Invoice = require('../models/Invoice');
const mongoose = require('mongoose');
const { getLotoMultiplierByStoreId } = require('./lotoMultiplierController');
const SpecialNumberGroup = require('../models/SpecialNumberGroup');

// Lấy thống kê tổng hợp tất cả cửa hàng của admin theo adminId
const getAdminTotalStatistics = async (req, res) => {
  try {
    const { date, adminId } = req.query;
    const requestAdminId = req.user.id; // AdminId từ token
    
    // Đảm bảo admin chỉ có thể xem thống kê của chính mình
    const targetAdminId = adminId || requestAdminId;
    
    if (targetAdminId !== requestAdminId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem thống kê của admin khác'
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ngày để thống kê'
      });
    }

    // Tạo date range cho ngày được chọn (UTC+7 timezone)
    const startDate = new Date(date + 'T00:00:00.000Z');
    const endDate = new Date(date + 'T23:59:59.999Z');
    
    // Adjust for Vietnam timezone (UTC+7)
    startDate.setHours(startDate.getHours() - 7);
    endDate.setHours(endDate.getHours() - 7);

    console.log(`Admin Total Stats Query:`, {
      adminId: targetAdminId,
      dateRange: { startDate, endDate }
    });

    // Tìm tất cả invoices của admin trong ngày (theo printedAt)
    const invoices = await Invoice.find({
      adminId: new mongoose.Types.ObjectId(targetAdminId),
      printedAt: {
        $gte: startDate,
        $lte: endDate
      }
    });

    console.log(`Found ${invoices.length} invoices for admin ${targetAdminId}`);

    // Lấy danh sách storeId từ các invoices để lấy hệ số lô và bộ động
    const storeIds = [...new Set(invoices.map(invoice => invoice.storeId.toString()))];
    const lotoMultipliers = {};
    const lotoPointsByStore = {}; // Điểm lô theo từng cửa hàng
    const boGroupMap = {}; // Bản đồ tên bộ -> danh sách số (động)
    
    // Lấy hệ số lô cho từng cửa hàng và khởi tạo điểm
    for (const storeId of storeIds) {
      lotoMultipliers[storeId] = await getLotoMultiplierByStoreId(storeId);
      lotoPointsByStore[storeId] = 0;
    }

    // Tải bộ (động) theo tất cả store của admin
    try {
      const boGroups = await SpecialNumberGroup.find({
        storeId: { $in: storeIds.map(id => new mongoose.Types.ObjectId(id)) },
        betType: 'bo',
        isActive: true
      });
      boGroups.forEach(g => {
        const name = String(g.name).trim();
        boGroupMap[name] = Array.isArray(g.numbers)
          ? g.numbers.map(n => String(n).padStart(2, '0')).filter(n => /^\d{2}$/.test(n))
          : [];
      });
    } catch (err) {
      console.error('Lỗi tải bộ động cho admin:', err);
    }
    
    // Không cần defaultLotoMultiplier nữa vì sẽ tính riêng theo từng store

    if (invoices.length === 0) {
      return res.json({
        success: true,
        stats: {
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
          xienTotal: 0,
          xienquayTotal: 0,
          loto: {},
          '2s': {},
          '3s': {},
          '4s': {},
          xien: {},
          xienquay: {},
          grouped: {
            tong: {},
            kep: {},
            dau: {},
            dit: {},
            bo: {}
          },
          lotoMultipliers: lotoMultipliers,
          lotoPointsByStore: {},
          lotoCalculationDetails: [],
          lotoCalculationString: '',
          totalLotoRevenue: 0
        }
      });
    }

    // Initialize statistics
    const stats = {
      totalRevenue: 0, // Tổng tiền khách trả (tính theo totalAmount)
      lotoTotal: 0,
      '2sTotal': 0,
      deaATotal: 0,
      loATotal: 0,
      '3sTotal': 0,
      '4sTotal': 0,
      tongTotal: 0, // Tổng tiền cược thực tế cho tổng
      kepTotal: 0,  // Tổng tiền cược thực tế cho kép
      dauTotal: 0,  // Tổng tiền cược thực tế cho đầu
      ditTotal: 0,  // Tổng tiền cược thực tế cho đít
      dauATotal: 0,
      ditATotal: 0,
      boTotal: 0,   // Tổng tiền cược thực tế cho bộ
      tongKepDauDitBoTotal: 0, // Tổng tiền khách trả cho nhóm tổng/kép/đầu/đít/bộ
      xienTotal: 0,
      xienquayTotal: 0,
      loto: {},
      '2s': {},
      deaA: {},
      '3s': {},
      '4s': {},
      loA: {},
      xien: {},
      xienquay: {},
      grouped: {
        tong: {},
        kep: {},
        dau: {},
        dit: {},
        daua: {},
        dita: {},
        bo: {}
      }
    };

    // Process each invoice
    invoices.forEach(invoice => {
      if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach(item => {
          const betType = item.betType.toLowerCase();
          const betAmount = item.totalAmount || 0;
          // Tổng tiền khách trả - luôn tính theo totalAmount
          stats.totalRevenue += betAmount;
          
                    if (betType === 'loto') {
            stats.lotoTotal += betAmount;
            
            // Tích lũy điểm lô theo từng cửa hàng (phải tính theo số lượng số)
            const storeId = invoice.storeId.toString();
            if (item.numbers && item.points) {
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const points = parseInt(item.points) || 0;
              const totalPointsForThisItem = points * numbers.length; // Điểm x số lượng số
              lotoPointsByStore[storeId] = (lotoPointsByStore[storeId] || 0) + totalPointsForThisItem;
            }
            
            // Loto statistics - accumulate points for each number (giữ nguyên cho bảng)
        if (item.numbers && item.points) {
          const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
          const points = parseInt(item.points) || 0;
          
          numbers.forEach(num => {
            const paddedNum = num.padStart(2, '0');
            if (!stats.loto[paddedNum]) {
              stats.loto[paddedNum] = 0;
            }
            stats.loto[paddedNum] += points; // points in đ
          });
        }
        }
        else if (betType === 'loa') {
          stats.loATotal += betAmount;
          if (item.numbers && item.points) {
            const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
            const points = parseInt(item.points) || 0;
            numbers.forEach(num => {
              const paddedNum = num.padStart(2, '0');
              if (!stats.loA[paddedNum]) {
                stats.loA[paddedNum] = 0;
              }
              stats.loA[paddedNum] += points;
            });
          }
        }
          else if (betType === '2s') {
            stats['2sTotal'] += betAmount;
            // 2S statistics - use individual bet amount per number, not total
            if (item.numbers && item.amount) {
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmountPerNumber = parseInt(item.amount) || 0;
              
              numbers.forEach(num => {
                const paddedNum = num.padStart(2, '0');
                if (!stats['2s'][paddedNum]) {
                  stats['2s'][paddedNum] = 0;
                }
                stats['2s'][paddedNum] += betAmountPerNumber; // amount per number in nghìn
              });
            }
          }
          else if (betType === 'deaa') { // betType stored in lowercase
            stats.deaATotal += betAmount;
            if (item.numbers && item.amount) {
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmountPerNumber = parseInt(item.amount) || 0;
              numbers.forEach(num => {
                const paddedNum = num.padStart(2, '0');
                stats.deaA[paddedNum] = (stats.deaA[paddedNum] || 0) + betAmountPerNumber;
              });
            }
          }
          else if (betType.includes('3s')) {
            stats['3sTotal'] += betAmount;
            // 3S statistics - tách từng con số
            const caseType = item.betType;
            if (!stats['3s'][caseType]) {
              stats['3s'][caseType] = {};
            }
            
                        // Tách từng con số từ chuỗi (xử lý cả dữ liệu cũ và mới)
            if (item.numbers) {
              // Tách chuỗi số - xử lý nhiều format: "123,456", "123, 456", "123 456"
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmountPerNumber = Math.floor(betAmount / numbers.length); // Chia đều cho từng con
              
              numbers.forEach(num => {
                const cleanNum = num.trim();
                const paddedNum = cleanNum.padStart(3, '0'); // 3 số nên pad 3 ký tự
                if (!stats['3s'][caseType][paddedNum]) {
                  stats['3s'][caseType][paddedNum] = {
                    totalAmount: 0,
                    count: 0
                  };
                }
                
                stats['3s'][caseType][paddedNum].totalAmount += betAmountPerNumber;
                stats['3s'][caseType][paddedNum].count = (stats['3s'][caseType][paddedNum].count || 0) + 1;
              });
            }
          }
          else if (betType.includes('4s')) {
            stats['4sTotal'] += betAmount;
            // 4S statistics - tách từng con số
            const caseType = item.betType;
            if (!stats['4s'][caseType]) {
              stats['4s'][caseType] = {};
            }
            
            // Tách từng con số từ chuỗi (xử lý cả dữ liệu cũ và mới)
            if (item.numbers) {
              // Tách chuỗi số - xử lý nhiều format: "1234,5678", "1234, 5678", "1234 5678"
              const numbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              const betAmountPerNumber = Math.floor(betAmount / numbers.length); // Chia đều cho từng con
              
              numbers.forEach(num => {
                const cleanNum = num.trim();
                const paddedNum = cleanNum.padStart(4, '0'); // 4 số nên pad 4 ký tự
                if (!stats['4s'][caseType][paddedNum]) {
                  stats['4s'][caseType][paddedNum] = {
                    totalAmount: 0,
                    count: 0
                  };
                }
                
                stats['4s'][caseType][paddedNum].totalAmount += betAmountPerNumber;
                stats['4s'][caseType][paddedNum].count = (stats['4s'][caseType][paddedNum].count || 0) + 1;
              });
            }
          }
          else if (betType.includes('xien') && !betType.includes('quay')) {
            stats.xienTotal += betAmount;
            // Xien statistics - tách từng con số
            const caseType = item.betType;
            if (!stats.xien[caseType]) {
              stats.xien[caseType] = {};
            }
            
                        // Tách từng tổ hợp xiên riêng biệt
            if (item.numbers) {
              // Tách theo dấu phẩy trước để tách các tổ hợp riêng biệt
              const combinations = item.numbers.split(',').map(combo => combo.trim()).filter(combo => combo.length > 0);
              const betAmountPerCombination = Math.floor(betAmount / combinations.length); // Chia đều cho từng tổ hợp
              
              combinations.forEach(combination => {
                // Tách từng tổ hợp thành các số (ví dụ: "12-33-22" -> ["12", "33", "22"])
                const numbers = combination.split(/[\s\-]+/).filter(n => n.length > 0);
                let numbersKey = numbers.join('-');
                
                // Thêm '(xiên nháy)' vào key nếu isXienNhay = true
                if (item.isXienNhay) {
                  numbersKey = `${numbersKey} (xiên nháy)`;
                }
                
                if (!stats.xien[caseType][numbersKey]) {
                  stats.xien[caseType][numbersKey] = {
                    numbers: numbers, // Mảng các số riêng biệt
                    totalAmount: 0,
                    count: 0
                  };
                }
                
                stats.xien[caseType][numbersKey].totalAmount += betAmountPerCombination;
                stats.xien[caseType][numbersKey].count = (stats.xien[caseType][numbersKey].count || 0) + 1;
              });
            }
          }
          else if (betType.includes('xienquay')) {
            stats.xienquayTotal += betAmount;
            // Xien Quay statistics - sử dụng amount (tiền cược của từng con) thay vì chia tổng tiền
            const caseType = item.betType;
            if (!stats.xienquay[caseType]) {
              stats.xienquay[caseType] = {};
            }
            
            // Sử dụng amount (tiền cược của từng con) nếu có, nếu không thì chia tổng tiền
            const amountPerNumber = item.amount || Math.floor(betAmount / (item.numbers ? item.numbers.split(',').length : 1));
            
            if (item.numbers) {
              // Tách theo dấu phẩy trước để tách các tổ hợp riêng biệt
              const combinations = item.numbers.split(',').map(combo => combo.trim()).filter(combo => combo.length > 0);
              
              combinations.forEach(combination => {
                // Tách từng tổ hợp thành các số (ví dụ: "12-33-44" -> ["12", "33", "44"])
                const numbers = combination.split(/[\s\-]+/).filter(n => n.length > 0);
                const numbersKey = numbers.join('-');
                
                if (!stats.xienquay[caseType][numbersKey]) {
                  stats.xienquay[caseType][numbersKey] = {
                    numbers: numbers, // Mảng các số riêng biệt
                    totalAmount: 0,
                    count: 0
                  };
                }
                
                stats.xienquay[caseType][numbersKey].totalAmount += amountPerNumber;
                stats.xienquay[caseType][numbersKey].count = (stats.xienquay[caseType][numbersKey].count || 0) + 1;
              });
            }
          }
          else if (['tong', 'kep', 'dau', 'dit', 'daua', 'dita', 'bo'].includes(betType)) {
            // Sử dụng amount (số tiền cược thực tế) cho các dòng chi tiết
            const actualBetAmount = item.amount || 0;
            const customerPaymentAmount = item.totalAmount || 0;
            
            // Update totals for grouped bet types - sử dụng số tiền khách trả
            switch(betType) {
              case 'tong': stats.tongTotal += customerPaymentAmount; break;
              case 'kep': stats.kepTotal += customerPaymentAmount; break;
              case 'dau': stats.dauTotal += customerPaymentAmount; break;
              case 'dit': stats.ditTotal += customerPaymentAmount; break;
              case 'daua': stats.dauATotal += customerPaymentAmount; break;
              case 'dita': stats.ditATotal += customerPaymentAmount; break;
              case 'bo': stats.boTotal += customerPaymentAmount; break;
            }
            
            // Cộng tổng tiền khách trả cho nhóm tổng/kép/đầu/đít/bộ (KHÔNG bao gồm Đầu A/Đít A)
            if (['tong', 'kep', 'dau', 'dit', 'bo'].includes(betType)) {
              stats.tongKepDauDitBoTotal += customerPaymentAmount;
            }
            
            // Grouped statistics (tong, kep, dau, dit, bo) - sử dụng số tiền cược thực tế
            if (betType === 'bo') {
              // Với bộ, tách từng bộ thành item riêng biệt
              const boNumbers = item.numbers.split(/[\s,]+/).filter(n => n.length > 0);
              boNumbers.forEach(boName => {
                const boNumber = boName.trim();
                if (!stats.grouped[betType][boNumber]) {
                  stats.grouped[betType][boNumber] = {
                    totalAmount: 0,
                    count: Array.isArray(boGroupMap[boNumber]) ? boGroupMap[boNumber].length : undefined,
                    detailString: `Bộ ${boNumber}${Array.isArray(boGroupMap[boNumber]) ? ` (${boGroupMap[boNumber].length} số)` : ''}: `
                  };
                }
                
                stats.grouped[betType][boNumber].totalAmount += actualBetAmount;
                const cnt = Array.isArray(stats.grouped[betType][boNumber].count)
                  ? stats.grouped[betType][boNumber].count
                  : (Array.isArray(boGroupMap[boNumber]) ? boGroupMap[boNumber].length : undefined);
                const countLabel = (typeof cnt === 'number') ? ` (${cnt} số)` : '';
                stats.grouped[betType][boNumber].detailString = `Bộ ${boNumber}${countLabel}: ${stats.grouped[betType][boNumber].totalAmount}n`;
              });
            } else {
              // Các loại khác giữ nguyên
              const numbersKey = item.numbers;
              const groupKey = betType;
              if (!stats.grouped[groupKey][numbersKey]) {
                stats.grouped[groupKey][numbersKey] = {
                  totalAmount: 0,
                  detailString: `${numbersKey}: `
                };
              }
              
              stats.grouped[groupKey][numbersKey].totalAmount += actualBetAmount;
              stats.grouped[groupKey][numbersKey].detailString = `${numbersKey}: ${stats.grouped[groupKey][numbersKey].totalAmount}n`;
            }
          }
        });
      }
    });

    // Tính toán loto theo logic mới
    let lotoCalculationDetails = [];
    let totalLotoRevenue = 0;
    
    Object.entries(lotoPointsByStore).forEach(([storeId, points]) => {
      if (points > 0) {
        const multiplier = lotoMultipliers[storeId] || 22;
        const revenue = points * multiplier;
        totalLotoRevenue += revenue;
        
        lotoCalculationDetails.push({
          storeId,
          points,
          multiplier,
          revenue
        });
      }
    });
    
    // Tạo string hiển thị phép tính
    const lotoCalculationString = lotoCalculationDetails
      .map(detail => `${detail.points} điểm × ${detail.multiplier}`)
      .join(' + ');
    
    // Thêm thông tin lô mới vào stats
    stats.lotoMultipliers = lotoMultipliers;
    stats.lotoPointsByStore = lotoPointsByStore;
    stats.lotoCalculationDetails = lotoCalculationDetails;
    stats.lotoCalculationString = lotoCalculationString;
    stats.totalLotoRevenue = totalLotoRevenue;
    // Thêm thông tin bộ động để frontend sử dụng khi gộp và hiển thị
    const boCounts = {};
    Object.entries(boGroupMap).forEach(([name, arr]) => { boCounts[name] = Array.isArray(arr) ? arr.length : 0; });
    stats.boCounts = boCounts;
    stats.boDefinitions = boGroupMap;



    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Lỗi khi lấy thống kê tổng hợp admin:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê tổng hợp'
    });
  }
};

module.exports = {
  getAdminTotalStatistics
};
