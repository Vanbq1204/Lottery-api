const WinningInvoice = require('../models/WinningInvoice');
const LotteryResult = require('../models/lotteryResult');
const { getVietnamDayRange } = require('../utils/dateUtils');

// Helper function to extract loto numbers from lottery result
const extractLotoNumbers = (lotteryResult) => {
  const lotoNumbers = [];
  
  if (lotteryResult && lotteryResult.results) {
    const results = lotteryResult.results;
    
    // Get all 2-digit numbers from all prizes
    const allPrizes = [
      results.gdb,
      results.g1,
      ...(results.g2 || []),
      ...(results.g3 || []),
      ...(results.g4 || []),
      ...(results.g5 || []),
      ...(results.g6 || []),
      ...(results.g7 || [])
    ].filter(prize => prize !== null && prize !== undefined);
    
    allPrizes.forEach(prize => {
      const prizeStr = String(prize);
      if (prizeStr.length >= 2) {
        const lastTwoDigits = prizeStr.slice(-2);
        lotoNumbers.push(lastTwoDigits);
      }
    });
  }
  
  return lotoNumbers;
};

// Helper function to count loto occurrences in KQXS
const countLotoOccurrences = (lotoNumbers, targetNumber) => {
  return lotoNumbers.filter(num => num === targetNumber).length;
};

// Hàm thống kê thưởng theo ngày
const getPrizeStatistics = async (req, res) => {
  try {
    const { date } = req.query;
    const user = req.user; // Lấy user từ token để filter theo storeId
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ngày thống kê'
      });
    }

    // Tạo date range với múi giờ Việt Nam
    const { startOfDay, endOfDay } = getVietnamDayRange(date);

    // Lấy winning invoices trong ngày theo lotteryDate VÀ storeId của user
    const winningInvoices = await WinningInvoice.find({
      storeId: user.storeId, // ✅ Thêm filter theo storeId
      lotteryDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    // Get lottery result for the date to calculate correct hit counts
    let lotoNumbersFromKQXS = [];
    if (date && winningInvoices.length > 0) {
      // Convert date format from YYYY-MM-DD to DD/MM/YYYY for lottery result search
      const [year, month, day] = date.split('-');
      const turnNum = `${day}/${month}/${year}`;
      
      const lotteryResult = await LotteryResult.findOne({
        turnNum: turnNum,
        storeId: user.storeId
      });
      
      if (lotteryResult) {
        lotoNumbersFromKQXS = extractLotoNumbers(lotteryResult);
        console.log('🎯 Loto numbers from KQXS:', lotoNumbersFromKQXS);
      }
    }

    // Phân tích thống kê
    const stats = analyzeWinningData(winningInvoices, lotoNumbersFromKQXS);
    
    res.json({
      success: true,
      date: date,
      totalInvoices: winningInvoices.length,
      totalPrizeAmount: winningInvoices.reduce((sum, inv) => sum + inv.totalPrizeAmount, 0),
      statistics: stats
    });

  } catch (error) {
    console.error('Lỗi thống kê thưởng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi thống kê thưởng'
    });
  }
};

// Hàm phân tích dữ liệu winning
const analyzeWinningData = (winningInvoices, lotoNumbersFromKQXS = []) => {
  const stats = {
    loto: {
      totalPrize: 0,
      totalWinningNumbers: 0,
      winningNumbers: {}, // {number: {count, totalPrize}}
      details: []
    },
    '2s': {
      totalPrize: 0,
      totalWinningNumbers: 0,
      winningNumbers: {},
      details: []
    },
    '3s': {
      totalPrize: 0,
      totalCases: 0,
      cases: {}, // {betType: {count, totalPrize, numbers: []}}
      details: []
    },
    xien: {
      totalPrize: 0,
      totalCases: 0,
      cases: {},
      details: []
    },
    xienquay: {
      totalPrize: 0,
      totalCases: 0,
      cases: {},
      details: []
    },
    others: { // tong, kep, dau, dit, bo
      totalPrize: 0,
      totalCases: 0,
      cases: {},
      details: []
    }
  };

  // Duyệt qua tất cả winning invoices
  winningInvoices.forEach(invoice => {
    invoice.winningItems.forEach(item => {
      const betType = item.betType;
      const prizeAmount = item.prizeAmount;
      
      // Phân loại và thống kê
      if (betType === 'loto') {
        analyzeLotoItem(item, stats.loto, lotoNumbersFromKQXS);
      } else if (betType === '2s') {
        analyze2sItem(item, stats['2s']);
      } else if (betType.startsWith('3s_')) {
        analyze3sItem(item, stats['3s']);
      } else if (betType.startsWith('xien') && !betType.startsWith('xienquay')) {
        analyzeXienItem(item, stats.xien);
      } else if (betType.startsWith('xienquay')) {
        analyzeXienQuayItem(item, stats.xienquay);
      } else if (['tong', 'kep', 'dau', 'dit', 'bo'].includes(betType)) {
        analyzeOtherItem(item, stats.others);
      }
    });
  });

  // Cập nhật tổng số con trúng cho lô tô cuối cùng
  stats.loto.totalWinningNumbers = Object.keys(stats.loto.winningNumbers).length;

  // Tính lại tổng thưởng 2 số sau khi đã phân tích tất cả items
  stats['2s'].totalPrize = Object.values(stats['2s'].winningNumbers).reduce((sum, data) => {
    return sum + data.totalPrize;
  }, 0);

  return stats;
};

// Phân tích lô tô
const analyzeLotoItem = (item, lotoStats, lotoNumbersFromKQXS = []) => {
  lotoStats.totalPrize += item.prizeAmount;
  
  // Parse loto numbers từ item.numbers
  // Format: "12x1(10đ), 71x1(10đ), 38x2(20đ)"
  const numberMatches = item.numbers.match(/(\d+)x(\d+)\((\d+)đ\)/g);
  const uniqueNumbers = new Set();
  
  if (numberMatches) {
    numberMatches.forEach(match => {
      const [, number, count, points] = match.match(/(\d+)x(\d+)\((\d+)đ\)/);
      const totalPoints = parseInt(points);
      const paddedNumber = number.padStart(2, '0');
      
      uniqueNumbers.add(paddedNumber); // Đếm số con cụ thể
      
      if (!lotoStats.winningNumbers[paddedNumber]) {
        // Calculate actual hit count from KQXS (số nháy thực tế)
        const actualHitCount = lotoNumbersFromKQXS.length > 0 
          ? countLotoOccurrences(lotoNumbersFromKQXS, paddedNumber)
          : parseInt(count); // Fallback to invoice data if no KQXS data
          
        lotoStats.winningNumbers[paddedNumber] = { 
          hitCount: actualHitCount, // Số nháy từ KQXS
          totalPoints: 0, 
          totalPrize: 0 
        };
      }
      
      // Cộng dồn điểm và tiền thưởng
      lotoStats.winningNumbers[paddedNumber].totalPoints += totalPoints;
      lotoStats.winningNumbers[paddedNumber].totalPrize += (totalPoints * item.multiplier * 1000);
    });
  }
  
  // Không cập nhật ở đây nữa - sẽ cập nhật cuối cùng
  
  lotoStats.details.push({
    numbers: item.numbers,
    betAmount: item.betAmount,
    multiplier: item.multiplier,
    prizeAmount: item.prizeAmount,
    detailString: item.detailString
  });
};

// Phân tích 2 số
const analyze2sItem = (item, stats2s) => {
  // Parse detailString để lấy số trúng thưởng thực sự
  // Ví dụ: "91: 5n x 85 = 425.000 đ" -> lấy số "91"
  const detailMatch = item.detailString.match(/^(\d+):/);
  if (detailMatch) {
    const winningNumber = detailMatch[1];
    
    if (!stats2s.winningNumbers[winningNumber]) {
      stats2s.winningNumbers[winningNumber] = { 
        count: 0, 
        totalBetAmount: 0,
        totalPrize: 0,
        multiplier: item.multiplier
      };
    }
    
    stats2s.winningNumbers[winningNumber].count += 1;
    stats2s.winningNumbers[winningNumber].totalBetAmount += item.betAmount;
    // Tính lại totalPrize dựa trên tổng betAmount và multiplier
    stats2s.winningNumbers[winningNumber].totalPrize = stats2s.winningNumbers[winningNumber].totalBetAmount * stats2s.winningNumbers[winningNumber].multiplier * 1000;
    stats2s.totalWinningNumbers += 1;
  }
  
  stats2s.details.push({
    numbers: item.numbers,
    betAmount: item.betAmount,
    multiplier: item.multiplier,
    prizeAmount: item.prizeAmount,
    detailString: item.detailString
  });
};

// Phân tích 3 số
const analyze3sItem = (item, stats3s) => {
  stats3s.totalPrize += item.prizeAmount;
  stats3s.totalCases += 1;
  
  const caseType = item.betType; // 3s_gdb, 3s_g1, etc.
  const caseLabel = item.betTypeLabel || item.betType;
  
  if (!stats3s.cases[caseType]) {
    stats3s.cases[caseType] = {
      label: caseLabel,
      count: 0,
      totalPrize: 0,
      numberGroups: {}, // Nhóm theo số để gộp
      details: []
    };
  }
  
  // Gộp theo số
  const number = item.numbers;
  if (!stats3s.cases[caseType].numberGroups[number]) {
    stats3s.cases[caseType].numberGroups[number] = {
      count: 0,
      totalBetAmount: 0,
      totalPrize: 0,
      multiplier: item.multiplier,
      detailString: item.detailString
    };
  }
  
  stats3s.cases[caseType].count += 1;
  stats3s.cases[caseType].totalPrize += item.prizeAmount;
  stats3s.cases[caseType].numberGroups[number].count += 1;
  stats3s.cases[caseType].numberGroups[number].totalBetAmount += item.betAmount;
  stats3s.cases[caseType].numberGroups[number].totalPrize += item.prizeAmount;
  
  stats3s.cases[caseType].details.push({
    numbers: item.numbers,
    betAmount: item.betAmount,
    multiplier: item.multiplier,
    prizeAmount: item.prizeAmount,
    detailString: item.detailString
  });
  
  stats3s.details.push({
    caseType: caseType,
    caseLabel: caseLabel,
    numbers: item.numbers,
    betAmount: item.betAmount,
    multiplier: item.multiplier,
    prizeAmount: item.prizeAmount,
    detailString: item.detailString
  });
};

// Phân tích xiên
const analyzeXienItem = (item, xienStats) => {
  xienStats.totalPrize += item.prizeAmount;
  xienStats.totalCases += 1;
  
  const caseType = item.betType; // xien2_full, xien3_2hit_both, etc.
  const caseLabel = item.betTypeLabel || item.betType;
  
  if (!xienStats.cases[caseType]) {
    xienStats.cases[caseType] = {
      label: caseLabel,
      count: 0,
      totalPrize: 0,
      numbers: [],
      details: []
    };
  }
  
  xienStats.cases[caseType].count += 1;
  xienStats.cases[caseType].totalPrize += item.prizeAmount;
  xienStats.cases[caseType].numbers.push(item.numbers);
  xienStats.cases[caseType].details.push({
    numbers: item.numbers,
    betAmount: item.betAmount,
    multiplier: item.multiplier,
    prizeAmount: item.prizeAmount,
    detailString: item.detailString
  });
  
  xienStats.details.push({
    caseType: caseType,
    caseLabel: caseLabel,
    numbers: item.numbers,
    betAmount: item.betAmount,
    multiplier: item.multiplier,
    prizeAmount: item.prizeAmount,
    detailString: item.detailString
  });
};

// Phân tích xiên quay
const analyzeXienQuayItem = (item, xienQuayStats) => {
  xienQuayStats.totalPrize += item.prizeAmount;
  xienQuayStats.totalCases += 1;
  
  const caseType = item.betType; // xienquay3, xienquay4, etc.
  const caseLabel = item.betTypeLabel || item.betType;
  
  if (!xienQuayStats.cases[caseType]) {
    xienQuayStats.cases[caseType] = {
      label: caseLabel,
      count: 0,
      totalPrize: 0,
      numbers: [],
      details: []
    };
  }
  
  xienQuayStats.cases[caseType].count += 1;
  xienQuayStats.cases[caseType].totalPrize += item.prizeAmount;
  xienQuayStats.cases[caseType].numbers.push(item.numbers);
  xienQuayStats.cases[caseType].details.push({
    numbers: item.numbers,
    betAmount: item.betAmount,
    multiplier: item.multiplier,
    prizeAmount: item.prizeAmount,
    detailString: item.detailString
  });
  
  xienQuayStats.details.push({
    caseType: caseType,
    caseLabel: caseLabel,
    numbers: item.numbers,
    betAmount: item.betAmount,
    multiplier: item.multiplier,
    prizeAmount: item.prizeAmount,
    detailString: item.detailString
  });
};

// Phân tích các loại khác (tong, kep, dau, dit, bo)
const analyzeOtherItem = (item, otherStats) => {
  otherStats.totalPrize += item.prizeAmount;
  otherStats.totalCases += 1;
  
  const caseType = item.betType;
  const caseLabel = item.betTypeLabel || item.betType;
  
  if (!otherStats.cases[caseType]) {
    otherStats.cases[caseType] = {
      label: caseLabel,
      count: 0,
      totalPrize: 0,
      numbers: [],
      details: []
    };
  }
  
  otherStats.cases[caseType].count += 1;
  otherStats.cases[caseType].totalPrize += item.prizeAmount;
  otherStats.cases[caseType].numbers.push(item.numbers);
  otherStats.cases[caseType].details.push({
    numbers: item.numbers,
    betAmount: item.betAmount,
    multiplier: item.multiplier,
    prizeAmount: item.prizeAmount,
    detailString: item.detailString
  });
};

module.exports = {
  getPrizeStatistics
}; 