const WinningInvoice = require('../models/WinningInvoice');
const Invoice = require('../models/Invoice');
const Store = require('../models/Store');
const User = require('../models/User');
const LotteryResult = require('../models/lotteryResult');
const { getVietnamDayRange } = require('../utils/dateUtils');

// Helper function to extract loto numbers from lottery result
const extractLotoNumbers = (lotteryResult) => {
  const lotoNumbers = [];
  
  if (!lotteryResult || !lotteryResult.results) return lotoNumbers;
  
  const results = lotteryResult.results;
  
  // Extract from GDB
  if (results.gdb) {
    lotoNumbers.push(results.gdb.slice(-2));
  }
  
  // Extract from G1
  if (results.g1) {
    lotoNumbers.push(results.g1.slice(-2));
  }
  
  // Extract from G2-G7
  ['g2', 'g3', 'g4', 'g5', 'g6', 'g7'].forEach(prize => {
    if (results[prize] && Array.isArray(results[prize])) {
      results[prize].forEach(num => {
        if (num && num.length >= 2) {
          lotoNumbers.push(num.slice(-2));
        }
      });
    }
  });
  
  return lotoNumbers;
};

// Helper function to count loto occurrences in KQXS
const countLotoOccurrences = (lotoNumbers, targetNumber) => {
  return lotoNumbers.filter(num => num === targetNumber).length;
};

// Get prize statistics for a specific store
const getStorePrizeStatistics = async (req, res) => {
  try {
    const { date, storeId } = req.query;
    const adminId = req.user.id;

    console.log('📊 Getting store prize statistics for:', { adminId, storeId, date });

    // Validate admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xem thống kê cửa hàng'
      });
    }

    // Validate storeId parameter
    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin cửa hàng'
      });
    }

    // Check if admin owns this store
    const store = await Store.findOne({ _id: storeId, adminId: adminId });
    if (!store) {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền truy cập cửa hàng này'
      });
    }

    console.log('🏪 Found store:', { storeName: store.name, storeId });

    // Set up date filter using Vietnam timezone
    let dateFilter = {};
    if (date) {
      // Create date range with Vietnam timezone
      const { startOfDay, endOfDay } = getVietnamDayRange(date);
      
      dateFilter = {
        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      };
      
      console.log('📅 Date filter (Vietnam timezone):', { 
        date, 
        startOfDay: startOfDay.toISOString(), 
        endOfDay: endOfDay.toISOString() 
      });
    }

    // Get winning invoices for this specific store
    const winningInvoices = await WinningInvoice.find({
      storeId: storeId,
      ...dateFilter
    }).populate('invoiceId');

    console.log('🎯 Found winning invoices:', { count: winningInvoices.length });

    // Count total betting invoices for this store
    const totalBettingInvoices = await Invoice.countDocuments({
      storeId: storeId,
      ...dateFilter
    });

    console.log('📋 Total betting invoices:', totalBettingInvoices);

    if (winningInvoices.length === 0) {
      return res.json({
        success: true,
        message: 'Không có hóa đơn trúng thưởng',
        totalInvoices: 0,
        totalBettingInvoices,
        totalPrizeAmount: 0,
        statistics: {
          loto: { totalPrize: 0, totalWinningNumbers: 0, winningNumbers: {} },
          '2s': { totalPrize: 0, winningNumbers: {} },
          '3s': { totalPrize: 0, totalCases: 0, cases: {} },
          '4s': { totalPrize: 0, totalCases: 0, cases: {} },
          xien: { totalPrize: 0, totalCases: 0, cases: {} },
          xienquay: { totalPrize: 0, totalCases: 0, cases: {} },
          others: { totalPrize: 0, totalCases: 0, cases: {} }
        }
      });
    }

    // Initialize statistics object
    const statistics = {
      loto: {
        totalPrize: 0,
        totalPoints: 0,
        totalWinningNumbers: 0,
        winningNumbers: {}
      },
      '2s': {
        totalPrize: 0,
        winningNumbers: {}
      },
      '3s': {
        totalPrize: 0,
        totalCases: 0,
        cases: {}
      },
      '4s': {
        totalPrize: 0,
        totalCases: 0,
        cases: {}
      },
      xien: {
        totalPrize: 0,
        totalCases: 0,
        cases: {}
      },
      xienquay: {
        totalPrize: 0,
        totalCases: 0,
        cases: {}
      },
      others: {
        totalPrize: 0,
        totalCases: 0,
        cases: {}
      }
    };

    let totalPrizeAmount = 0;

    // Get lottery results for the date to calculate accurate loto hit counts
    let lotoNumbersFromKQXS = [];
    if (date && winningInvoices.length > 0) {
      // Convert date format from YYYY-MM-DD to DD/MM/YYYY for lottery result search
      const [year, month, day] = date.split('-');
      const turnNum = `${day}/${month}/${year}`;
      
      try {
        // Lấy kết quả xổ số global (không phụ thuộc store)
        const lotteryResultsQuery = await LotteryResult.find({
          turnNum: turnNum
          // Loại bỏ storeId filter - tất cả store sử dụng chung kết quả
        });
        
        console.log('🎲 Found lottery results:', { 
          turnNum, 
          count: lotteryResultsQuery.length
        });
        
        if (lotteryResultsQuery.length > 0) {
          // Use the first lottery result to extract loto numbers (global KQXS)
          lotoNumbersFromKQXS = extractLotoNumbers(lotteryResultsQuery[0]);
          console.log('🎲 Extracted loto numbers from KQXS:', lotoNumbersFromKQXS.length, 'numbers');
        } else {
          console.log('⚠️ No lottery result found for turnNum:', turnNum);
        }
      } catch (error) {
        console.error('❌ Error fetching lottery result:', error);
      }
    }

    // Process each winning invoice
    for (const winningInvoice of winningInvoices) {
      totalPrizeAmount += winningInvoice.totalPrizeAmount;

      // Process each winning item in the invoice
      for (const winningItem of winningInvoice.winningItems) {
        const betType = winningItem.betType;
        const prizeAmount = winningItem.prizeAmount;
        const numbersString = winningItem.numbers;
        const betAmount = winningItem.betAmount;
        const multiplier = winningItem.multiplier;

        if (prizeAmount === 0) continue;

        switch (betType) {
          case 'loto':
            // Loto statistics - Parse loto format like "12x1(10đ), 71x1(10đ), 38x2(20đ)"
            statistics.loto.totalPrize += prizeAmount;
            
            const lotoMatches = numbersString.match(/(\d+)x(\d+)\((\d+)đ\)/g);
            
            if (lotoMatches) {
              lotoMatches.forEach(match => {
                const [, number, hitCountFromInvoice, points] = match.match(/(\d+)x(\d+)\((\d+)đ\)/);
                const num = number.padStart(2, '0'); // Ensure 2 digits
                const totalPoints = parseInt(points);
                
                // Calculate actual hit count from KQXS (số nháy thực tế)
                const actualHitCount = lotoNumbersFromKQXS.length > 0 
                  ? countLotoOccurrences(lotoNumbersFromKQXS, num)
                  : parseInt(hitCountFromInvoice); // Fallback to invoice data if no KQXS data
                
                if (!statistics.loto.winningNumbers[num]) {
                  statistics.loto.winningNumbers[num] = {
                    count: 0,
                    hitCount: actualHitCount, // Số nháy từ KQXS (không cộng dồn)
                    totalPoints: 0,
                    totalPrize: 0
                  };
                } else {
                  // Ensure hitCount is consistent (from KQXS, not cumulative)
                  statistics.loto.winningNumbers[num].hitCount = actualHitCount;
                }
                
                statistics.loto.winningNumbers[num].count += 1; // Số lần xuất hiện trong hóa đơn
                
                // Cộng dồn điểm và tiền thưởng (giống logic nhân viên)
                statistics.loto.winningNumbers[num].totalPoints += totalPoints;
                statistics.loto.winningNumbers[num].totalPrize += (totalPoints * multiplier * 1000);
              });
            }
            
            statistics.loto.totalWinningNumbers = Object.keys(statistics.loto.winningNumbers).length;
            break;

          case '2s':
            // 2s statistics - Parse detailString để lấy số trúng thưởng thực sự
            const detailMatch = winningItem.detailString.match(/^(\d+):/);
            if (detailMatch) {
              const winningNumber = detailMatch[1];
              
              if (!statistics['2s'].winningNumbers[winningNumber]) {
                statistics['2s'].winningNumbers[winningNumber] = {
                  count: 0,
                  totalBetAmount: 0,
                  totalPrize: 0,
                  multiplier: multiplier
                };
              }
              
              statistics['2s'].winningNumbers[winningNumber].count += 1;
              statistics['2s'].winningNumbers[winningNumber].totalBetAmount += betAmount;
              // Cộng trực tiếp prizeAmount thực tế thay vì tính lại với multiplier
              // Điều này đảm bảo tính đúng khi các cửa hàng có hệ số thưởng khác nhau
              statistics['2s'].winningNumbers[winningNumber].totalPrize += prizeAmount;
            }
            break;

          default:
            // Handle bet types using startsWith logic like adminPrizeStatsController.js
            if (betType.startsWith('3s')) {
              // 3s statistics
              statistics['3s'].totalPrize += prizeAmount;
              statistics['3s'].totalCases += 1;
              
              // Use betType directly since winningType is not set in DB
              const caseType3s = betType;
              if (!statistics['3s'].cases[caseType3s]) {
                statistics['3s'].cases[caseType3s] = {
                  label: getCaseLabel(caseType3s),
                  totalPrize: 0,
                  details: [],
                  numberGroups: {}
                };
              }
              
              statistics['3s'].cases[caseType3s].totalPrize += prizeAmount;
              
              // Group by numbers for better display
              if (!statistics['3s'].cases[caseType3s].numberGroups[numbersString]) {
                statistics['3s'].cases[caseType3s].numberGroups[numbersString] = {
                  totalBetAmount: 0,
                  totalPrize: 0,
                  multiplier: multiplier,
                  count: 0
                };
              }
              
              statistics['3s'].cases[caseType3s].numberGroups[numbersString].totalBetAmount += betAmount;
              statistics['3s'].cases[caseType3s].numberGroups[numbersString].totalPrize += prizeAmount;
              statistics['3s'].cases[caseType3s].numberGroups[numbersString].count += 1;
              
              // Add detail for display
              statistics['3s'].cases[caseType3s].details.push({
                numbers: numbersString,
                betAmount: betAmount,
                multiplier: multiplier,
                prizeAmount: prizeAmount
              });
              
            } else if (betType.startsWith('4s')) {
              // 4s statistics
              statistics['4s'].totalPrize += prizeAmount;
              statistics['4s'].totalCases += 1;
              
              // Use betType directly since winningType is not set in DB
              const caseType4s = betType;
              if (!statistics['4s'].cases[caseType4s]) {
                statistics['4s'].cases[caseType4s] = {
                  label: getCaseLabel(caseType4s),
                  totalPrize: 0,
                  details: [],
                  numberGroups: {}
                };
              }
              
              statistics['4s'].cases[caseType4s].totalPrize += prizeAmount;
              
              // Group by numbers for better display
              if (!statistics['4s'].cases[caseType4s].numberGroups[numbersString]) {
                statistics['4s'].cases[caseType4s].numberGroups[numbersString] = {
                  totalBetAmount: 0,
                  totalPrize: 0,
                  multiplier: multiplier,
                  count: 0
                };
              }
              
              statistics['4s'].cases[caseType4s].numberGroups[numbersString].totalBetAmount += betAmount;
              statistics['4s'].cases[caseType4s].numberGroups[numbersString].totalPrize += prizeAmount;
              statistics['4s'].cases[caseType4s].numberGroups[numbersString].count += 1;
              
              // Add detail for display
              statistics['4s'].cases[caseType4s].details.push({
                numbers: numbersString,
                betAmount: betAmount,
                multiplier: multiplier,
                prizeAmount: prizeAmount
              });
              
            } else if ((betType === 'xien' || betType === 'xien2' || betType === 'xien3' || betType === 'xien4' || betType.includes('xien')) && !betType.includes('xienquay')) {
              // Xien statistics (exclude xienquay)
              statistics.xien.totalPrize += prizeAmount;
              statistics.xien.totalCases += 1;
              
              // Use betType directly since winningType might not be set
              const caseTypeXien = betType;
              if (!statistics.xien.cases[caseTypeXien]) {
                statistics.xien.cases[caseTypeXien] = {
                  label: getCaseLabel(caseTypeXien),
                  totalPrize: 0,
                  details: [],
                  numberGroups: {}
                };
              }
              
              statistics.xien.cases[caseTypeXien].totalPrize += prizeAmount;
              
              // Group by numbers for better display
              if (!statistics.xien.cases[caseTypeXien].numberGroups[numbersString]) {
                statistics.xien.cases[caseTypeXien].numberGroups[numbersString] = {
                  totalBetAmount: 0,
                  totalPrize: 0,
                  multiplier: multiplier,
                  count: 0,
                  isXienNhay: winningItem.isXienNhay || false
                };
              }
              
              statistics.xien.cases[caseTypeXien].numberGroups[numbersString].totalBetAmount += betAmount;
              statistics.xien.cases[caseTypeXien].numberGroups[numbersString].totalPrize += prizeAmount;
              statistics.xien.cases[caseTypeXien].numberGroups[numbersString].count += 1;
              // Update isXienNhay if any item in this group is xiên nháy
              if (winningItem.isXienNhay) {
                statistics.xien.cases[caseTypeXien].numberGroups[numbersString].isXienNhay = true;
              }
              
              statistics.xien.cases[caseTypeXien].details.push({
                numbers: numbersString,
                betAmount: betAmount,
                multiplier: multiplier,
                prizeAmount: prizeAmount,
                detailString: `${numbersString}: ${betAmount}n x ${multiplier} = ${prizeAmount.toLocaleString('vi-VN')} đ`,
                isXienNhay: winningItem.isXienNhay || false
              });
              
            } else if (betType === 'xienquay' || betType === 'xienquay3' || betType === 'xienquay4' || betType.includes('xienquay')) {
              // Xien quay statistics
              statistics.xienquay.totalPrize += prizeAmount;
              statistics.xienquay.totalCases += 1;
              
              // Use betType directly since winningType might not be set
              const caseTypeXienQuay = betType;
              if (!statistics.xienquay.cases[caseTypeXienQuay]) {
                statistics.xienquay.cases[caseTypeXienQuay] = {
                  label: getCaseLabel(caseTypeXienQuay),
                  totalPrize: 0,
                  details: [],
                  numberGroups: {}
                };
              }
              
              statistics.xienquay.cases[caseTypeXienQuay].totalPrize += prizeAmount;
              
              // Group by numbers for better display
              if (!statistics.xienquay.cases[caseTypeXienQuay].numberGroups[numbersString]) {
                statistics.xienquay.cases[caseTypeXienQuay].numberGroups[numbersString] = {
                  totalBetAmount: 0,
                  totalPrize: 0,
                  multiplier: multiplier,
                  count: 0
                };
              }
              
              statistics.xienquay.cases[caseTypeXienQuay].numberGroups[numbersString].totalBetAmount += betAmount;
              statistics.xienquay.cases[caseTypeXienQuay].numberGroups[numbersString].totalPrize += prizeAmount;
              statistics.xienquay.cases[caseTypeXienQuay].numberGroups[numbersString].count += 1;
              
              statistics.xienquay.cases[caseTypeXienQuay].details.push({
                numbers: numbersString,
                betAmount: betAmount,
                multiplier: multiplier,
                prizeAmount: prizeAmount,
                detailString: `${numbersString}: ${betAmount}n x ${multiplier} = ${prizeAmount.toLocaleString('vi-VN')} đ`
              });
              
            } else if (['tong', 'kep', 'dau', 'dit', 'bo'].includes(betType)) {
              // Others statistics (tong, kep, dau, dit, bo)
              statistics.others.totalPrize += prizeAmount;
              statistics.others.totalCases += 1;
              
              const caseTypeOthers = betType;
              if (!statistics.others.cases[caseTypeOthers]) {
                statistics.others.cases[caseTypeOthers] = {
                  label: getCaseLabel(caseTypeOthers),
                  totalPrize: 0,
                  details: [],
                  numberGroups: {}
                };
              }
              
              statistics.others.cases[caseTypeOthers].totalPrize += prizeAmount;
              
              // Group by numbers for better display
              if (!statistics.others.cases[caseTypeOthers].numberGroups[numbersString]) {
                statistics.others.cases[caseTypeOthers].numberGroups[numbersString] = {
                  totalBetAmount: 0,
                  totalPrize: 0,
                  multiplier: multiplier,
                  count: 0
                };
              }
              
              statistics.others.cases[caseTypeOthers].numberGroups[numbersString].totalBetAmount += betAmount;
              statistics.others.cases[caseTypeOthers].numberGroups[numbersString].totalPrize += prizeAmount;
              statistics.others.cases[caseTypeOthers].numberGroups[numbersString].count += 1;
              
              statistics.others.cases[caseTypeOthers].details.push({
                numbers: numbersString,
                betAmount: betAmount,
                multiplier: multiplier,
                prizeAmount: prizeAmount,
                detailString: `${numbersString}: ${betAmount}n x ${multiplier} = ${prizeAmount.toLocaleString('vi-VN')} đ`
              });
              
            } else {
              // Handle any other bet types that don't fit the above categories
              console.log(`⚠️ Unknown bet type: ${betType}`);
            }
            break;



        }
      }
    }

    // Tính lại tổng thưởng 2 số sau khi đã phân tích tất cả items
    statistics['2s'].totalPrize = Object.values(statistics['2s'].winningNumbers).reduce((sum, data) => {
      return sum + data.totalPrize;
    }, 0);

    // Tính tổng điểm cho loto sau khi đã phân tích tất cả items
    statistics.loto.totalPoints = Object.values(statistics.loto.winningNumbers).reduce((sum, data) => {
      return sum + (data.totalPoints || 0);
    }, 0);

    // Calculate total winning numbers for loto
    statistics.loto.totalWinningNumbers = Object.keys(statistics.loto.winningNumbers).length;

    console.log('📊 Statistics summary:', {
      totalInvoices: winningInvoices.length,
      totalBettingInvoices,
      totalPrizeAmount,
      lotoWinningNumbers: statistics.loto.totalWinningNumbers,
      lotoPrize: statistics.loto.totalPrize,
      '2sPrize': statistics['2s'].totalPrize,
      '3sPrize': statistics['3s'].totalPrize,
      '4sPrize': statistics['4s'].totalPrize,
      xienPrize: statistics.xien.totalPrize,
      xienquayPrize: statistics.xienquay.totalPrize,
      othersPrize: statistics.others.totalPrize
    });

    res.json({
      success: true,
      totalInvoices: winningInvoices.length,
      totalBettingInvoices,
      totalPrizeAmount,
      storeName: store.name,
      storeId: store._id,
      statistics
    });

  } catch (error) {
    console.error('❌ Error in getStorePrizeStatistics:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê thưởng cửa hàng',
      error: error.message
    });
  }
};

// Helper function to get case label
const getCaseLabel = (caseType) => {
  const caseLabels = {
    // 3s cases
    '3s': '3 số',
    '3straight': 'Thẳng 3 số',
    '3box': 'Xiên 3 số',
    '3ibox': 'Xiên thẳng 3 số',
    '3s_gdb': '3 số giải đặc biệt',
    '3s_g1': '3 số giải nhất',
    '3s_g6': '3 số giải 6',
    '3s_g7': '3 số giải 7',
    '3s_g8': '3 số giải 8',
    'straight': 'Thẳng',
    'box': 'Xiên',
    'ibox': 'Xiên thẳng',
    
    // 4s cases
    '4s': '4 số',
    '4straight': 'Thẳng 4 số',
    '4box': 'Xiên 4 số',
    '4ibox': 'Xiên thẳng 4 số',
    
    // Xien cases
    'xien2': 'Xiên 2',
    'xien3': 'Xiên 3',
    'xien4': 'Xiên 4',
    'xien3_full': 'Xiên 3 full',
    'xien4_full': 'Xiên 4 full',
    
    // Xienquay cases
    'xienquay': 'Xiên quay',
    'xienquay2': 'Xiên quay 2',
    'xienquay3': 'Xiên quay 3',
    'xienquay4': 'Xiên quay 4',
    'xienquay3_full': 'Xiên quay 3 full',
    'xienquay4_full': 'Xiên quay 4 full',
    
    // Other cases
    'tong': 'Tổng',
    'kep': 'Kép',
    'dau': 'Đầu',
    'dit': 'Đít',
    'bo': 'Bộ'
  };
  
  return caseLabels[caseType] || caseType;
};

module.exports = {
  getStorePrizeStatistics
};