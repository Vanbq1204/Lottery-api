const WinningInvoice = require('../models/WinningInvoice');
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

// Get admin prize statistics for all stores managed by admin
const getAdminPrizeStatistics = async (req, res) => {
  try {
    const { date } = req.query;
    const adminId = req.user.id;

    console.log('📊 Getting admin prize statistics for:', { adminId, date });

    // Validate admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xem thống kê tổng hợp'
      });
    }

    // Get all stores managed by this admin
    const stores = await Store.find({ adminId: adminId });
    const storeIds = stores.map(store => store._id);

    console.log('🏪 Found stores:', { count: stores.length, storeIds });

    if (storeIds.length === 0) {
      return res.json({
        success: true,
        message: 'Không có cửa hàng nào',
        totalInvoices: 0,
        totalPrizeAmount: 0,
        totalStores: 0,
        statistics: {
          loto: { totalPrize: 0, totalWinningNumbers: 0, winningNumbers: {} },
          '2s': { totalPrize: 0, winningNumbers: {} },
          '3s': { totalPrize: 0, totalCases: 0, cases: {} },
          xien: { totalPrize: 0, totalCases: 0, cases: {} },
          xienquay: { totalPrize: 0, totalCases: 0, cases: {} },
          others: { totalPrize: 0, totalCases: 0, cases: {} }
        }
      });
    }

    // Set up date filter using Vietnam timezone (same as employee statistics)
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

    // Get all winning invoices from all stores managed by admin
    const winningInvoices = await WinningInvoice.find({
      storeId: { $in: storeIds },
      ...dateFilter
    }).populate('invoiceId').populate('storeId');

    console.log('🎯 Found winning invoices:', { count: winningInvoices.length });

    // Get lottery results for the date to calculate correct hit counts
    let lotteryResults = [];
    let lotoNumbersFromKQXS = [];
    
    if (date && winningInvoices.length > 0) {
      // Convert date format from YYYY-MM-DD to DD/MM/YYYY for lottery result search
      const [year, month, day] = date.split('-');
      const turnNum = `${day}/${month}/${year}`;
      
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
        console.log('🎯 Loto numbers from KQXS:', lotoNumbersFromKQXS);
      }
    }

    if (winningInvoices.length === 0) {
      return res.json({
        success: true,
        message: 'Không có dữ liệu thống kê thưởng',
        totalInvoices: 0,
        totalPrizeAmount: 0,
        totalStores: storeIds.length,
        statistics: {
          loto: { totalPrize: 0, totalWinningNumbers: 0, winningNumbers: {} },
          '2s': { totalPrize: 0, winningNumbers: {} },
          '3s': { totalPrize: 0, totalCases: 0, cases: {} },
          xien: { totalPrize: 0, totalCases: 0, cases: {} },
          xienquay: { totalPrize: 0, totalCases: 0, cases: {} },
          others: { totalPrize: 0, totalCases: 0, cases: {} }
        }
      });
    }

    // Initialize statistics structure
    const statistics = {
      loto: {
        totalPrize: 0,
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

    // Process each winning invoice
    for (const winningInvoice of winningInvoices) {
      totalPrizeAmount += winningInvoice.totalPrizeAmount || 0;
      
      // Process each winning item in the invoice
      if (winningInvoice.winningItems && winningInvoice.winningItems.length > 0) {
        for (const item of winningInvoice.winningItems) {
          const { betType, numbers, betAmount, multiplier, prizeAmount, winningType, detailString } = item;

          // Process based on bet type
          if (betType === 'loto') {
            // Loto statistics
            statistics.loto.totalPrize += prizeAmount;
            
            // Parse loto format like "12x1(10đ), 71x1(10đ), 38x2(20đ)"
            const lotoMatches = numbers.match(/(\d+)x(\d+)\((\d+)đ\)/g);
            
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

          } else if (betType === '2s') {
            // 2s statistics - Parse detailString để lấy số trúng thưởng thực sự
            const detailMatch = detailString.match(/^(\d+):/);
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
              // Tính lại totalPrize dựa trên tổng betAmount và multiplier
              statistics['2s'].winningNumbers[winningNumber].totalPrize = statistics['2s'].winningNumbers[winningNumber].totalBetAmount * statistics['2s'].winningNumbers[winningNumber].multiplier * 1000;
            }

          } else if (betType.startsWith('3s')) {
            // 3s statistics
            statistics['3s'].totalPrize += prizeAmount;
            statistics['3s'].totalCases += 1;
            
            // Use betType directly since winningType is not set in DB
            const caseType = betType;
            if (!statistics['3s'].cases[caseType]) {
              statistics['3s'].cases[caseType] = {
                label: getCaseLabel(caseType),
                totalPrize: 0,
                details: [],
                numberGroups: {}
              };
            }
            
            statistics['3s'].cases[caseType].totalPrize += prizeAmount;
            
            // Group by numbers for better display
            if (!statistics['3s'].cases[caseType].numberGroups[numbers]) {
              statistics['3s'].cases[caseType].numberGroups[numbers] = {
                totalBetAmount: 0,
                totalPrize: 0,
                multiplier: multiplier,
                count: 0
              };
            }
            
            statistics['3s'].cases[caseType].numberGroups[numbers].totalBetAmount += betAmount;
            statistics['3s'].cases[caseType].numberGroups[numbers].totalPrize += prizeAmount;
            statistics['3s'].cases[caseType].numberGroups[numbers].count += 1;
            
            console.log(`🎯 3S: ${caseType} - ${numbers}: ${betAmount}n x ${multiplier} = ${prizeAmount}`);
            
            // Add detail for display
            statistics['3s'].cases[caseType].details.push({
              numbers: numbers,
              betAmount: betAmount,
              multiplier: multiplier,
              prizeAmount: prizeAmount
            });

          } else if (betType === 'xien' || betType === 'xien2' || betType === 'xien3' || betType === 'xien4' || betType.includes('xien') && !betType.includes('xienquay')) {
            // Xien statistics
            statistics.xien.totalPrize += prizeAmount;
            statistics.xien.totalCases += 1;
            
            // Use betType directly since winningType might not be set
            const caseType = betType;
            if (!statistics.xien.cases[caseType]) {
              statistics.xien.cases[caseType] = {
                label: getCaseLabel(caseType),
                totalPrize: 0,
                details: [],
                numberGroups: {}
              };
            }
            
            statistics.xien.cases[caseType].totalPrize += prizeAmount;
            
            // Group by numbers for better display
            if (!statistics.xien.cases[caseType].numberGroups[numbers]) {
              statistics.xien.cases[caseType].numberGroups[numbers] = {
                totalBetAmount: 0,
                totalPrize: 0,
                multiplier: multiplier,
                count: 0
              };
            }
            
            statistics.xien.cases[caseType].numberGroups[numbers].totalBetAmount += betAmount;
            statistics.xien.cases[caseType].numberGroups[numbers].totalPrize += prizeAmount;
            statistics.xien.cases[caseType].numberGroups[numbers].count += 1;
            
            statistics.xien.cases[caseType].details.push({
              numbers: numbers,
              betAmount: betAmount,
              multiplier: multiplier,
              prizeAmount: prizeAmount,
              detailString: `${numbers}: ${betAmount}n x ${multiplier} = ${prizeAmount.toLocaleString('vi-VN')} đ`
            });

          } else if (betType === 'xienquay' || betType === 'xienquay3' || betType === 'xienquay4' || betType.includes('xienquay')) {
            // Xien quay statistics
            statistics.xienquay.totalPrize += prizeAmount;
            statistics.xienquay.totalCases += 1;
            
            // Use betType directly since winningType might not be set
            const caseType = betType;
            if (!statistics.xienquay.cases[caseType]) {
              statistics.xienquay.cases[caseType] = {
                label: getCaseLabel(caseType),
                totalPrize: 0,
                details: [],
                numberGroups: {}
              };
            }
            
            statistics.xienquay.cases[caseType].totalPrize += prizeAmount;
            
            // Group by numbers for better display
            if (!statistics.xienquay.cases[caseType].numberGroups[numbers]) {
              statistics.xienquay.cases[caseType].numberGroups[numbers] = {
                totalBetAmount: 0,
                totalPrize: 0,
                multiplier: multiplier,
                count: 0
              };
            }
            
            statistics.xienquay.cases[caseType].numberGroups[numbers].totalBetAmount += betAmount;
            statistics.xienquay.cases[caseType].numberGroups[numbers].totalPrize += prizeAmount;
            statistics.xienquay.cases[caseType].numberGroups[numbers].count += 1;
            
            statistics.xienquay.cases[caseType].details.push({
              numbers: numbers,
              betAmount: betAmount,
              multiplier: multiplier,
              prizeAmount: prizeAmount,
              detailString: `${numbers}: ${betAmount}n x ${multiplier} = ${prizeAmount.toLocaleString('vi-VN')} đ`
            });

          } else if (['tong', 'kep', 'dau', 'dit', 'bo'].includes(betType)) {
            // Others statistics (tong, kep, dau, dit, bo)
            statistics.others.totalPrize += prizeAmount;
            statistics.others.totalCases += 1;
            
            const caseType = betType;
            if (!statistics.others.cases[caseType]) {
              statistics.others.cases[caseType] = {
                label: getCaseLabel(caseType),
                totalPrize: 0,
                details: [],
                numberGroups: {}
              };
            }
            
            statistics.others.cases[caseType].totalPrize += prizeAmount;
            
            // Group by numbers for better display
            if (!statistics.others.cases[caseType].numberGroups[numbers]) {
              statistics.others.cases[caseType].numberGroups[numbers] = {
                totalBetAmount: 0,
                totalPrize: 0,
                multiplier: multiplier,
                count: 0
              };
            }
            
            statistics.others.cases[caseType].numberGroups[numbers].totalBetAmount += betAmount;
            statistics.others.cases[caseType].numberGroups[numbers].totalPrize += prizeAmount;
            statistics.others.cases[caseType].numberGroups[numbers].count += 1;
            
            statistics.others.cases[caseType].details.push({
              numbers: numbers,
              betAmount: betAmount,
              multiplier: multiplier,
              prizeAmount: prizeAmount,
              detailString: `${numbers}: ${betAmount}n x ${multiplier} = ${prizeAmount.toLocaleString('vi-VN')} đ`
            });
          }
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

    console.log('📊 Statistics summary:', {
      totalInvoices: winningInvoices.length,
      totalPrizeAmount,
      totalStores: storeIds.length,
      lotoTotal: statistics.loto.totalPrize,
      '2sTotal': statistics['2s'].totalPrize,
      '3sTotal': statistics['3s'].totalPrize,
      xienTotal: statistics.xien.totalPrize,
      xienquayTotal: statistics.xienquay.totalPrize,
      othersTotal: statistics.others.totalPrize
    });

    res.json({
      success: true,
      message: 'Lấy thống kê thưởng tổng hợp thành công',
      totalInvoices: winningInvoices.length,
      totalPrizeAmount,
      totalStores: storeIds.length,
      statistics
    });

  } catch (error) {
    console.error('❌ Error getting admin prize statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê thưởng tổng hợp',
      error: error.message
    });
  }
};

// Helper function to get case labels
const getCaseLabel = (caseType) => {
  const labels = {
    // 3s cases
    '3s_gdb': '3 số trùng GĐB',
    '3s_gdb_g1': '3 số trùng cả GĐB và G1',
    '3s_g1': '3 số trùng G1',
    '3s_g6': '3 số trùng G6',
    
    // Xien cases
    'xien2_full': 'Xiên 2 đủ',
    'xien2_1hit': 'Xiên 2 trúng 1',
    'xien3_full': 'Xiên 3 đủ',
    'xien3_2hit_both': 'Xiên 3 trúng 2 (cả 2)',
    'xien3_2hit_one': 'Xiên 3 trúng 2 (1 trong 2)',
    'xien4_full': 'Xiên 4 đủ',
    'xien4_3hit_all': 'Xiên 4 trúng 3 (tất cả)',
    'xien4_3hit_two': 'Xiên 4 trúng 3 (2 trong 3)',
    'xien4_3hit_one': 'Xiên 4 trúng 3 (1 trong 3)',
    
    // Xien quay cases
    'xienquay3': 'Xiên quay 3',
    'xienquay4': 'Xiên quay 4',
    
    // Others cases
    'tong': 'Tổng',
    'kep': 'Kép',
    'dau': 'Đầu',
    'dit': 'Đít',
    'bo': 'Bộ',
    
    // Fallback bet types
    'loto': 'Lô tô',
    '2s': '2 số',
    '3s': '3 số',
    'xien': 'Xiên',
    'xien2': 'Xiên 2',
    'xien3': 'Xiên 3',
    'xien4': 'Xiên 4',
    'xienquay': 'Xiên quay'
  };
  
  return labels[caseType] || caseType.toUpperCase();
};

module.exports = {
  getAdminPrizeStatistics
}; 