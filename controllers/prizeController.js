const Invoice = require('../models/Invoice');
const WinningInvoice = require('../models/WinningInvoice');
const PrizeMultiplier = require('../models/PrizeMultiplier');
const { getVietnamDayRange } = require('../utils/dateUtils');

// Helper function để lấy multiplier theo storeId
const getMultiplierByStore = async (storeId, betType, isActive = true) => {
  return await PrizeMultiplier.findOne({ 
    storeId, 
    betType, 
    isActive 
  });
};

// Hàm tính tổ hợp C(n, k)
const combination = (n, k) => {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
};

// Hàm sinh tất cả tổ hợp k phần tử từ mảng arr
const getCombinations = (arr, k) => {
  if (k === 1) return arr.map(x => [x]);
  if (k === arr.length) return [arr];
  
  const result = [];
  
  for (let i = 0; i <= arr.length - k; i++) {
    const head = arr[i];
    const tailCombinations = getCombinations(arr.slice(i + 1), k - 1);
    tailCombinations.forEach(tail => {
      result.push([head, ...tail]);
    });
  }
  
  return result;
};

// Hàm sinh tất cả tổ hợp xiên quay từ danh sách số
const generateXienQuayCombinations = (numbers) => {
  const n = numbers.length;
  const combinations = [];
  
  if (n === 3) {
    // Xiên quay 3: 2C(3) + 3C(3) = 3 + 1 = 4 con
    combinations.push(...getCombinations(numbers, 2)); // 3 cặp 2 số
    combinations.push(...getCombinations(numbers, 3)); // 1 bộ 3 số
  } else if (n === 4) {
    // Xiên quay 4: 2C(4) + 3C(4) + 4C(4) = 6 + 4 + 1 = 11 con
    combinations.push(...getCombinations(numbers, 2)); // 6 cặp 2 số
    combinations.push(...getCombinations(numbers, 3)); // 4 bộ 3 số
    combinations.push(...getCombinations(numbers, 4)); // 1 bộ 4 số
  }
  
  return combinations;
};
const LotteryResult = require('../models/lotteryResult');

// Hàm lấy tất cả số cuối 2 chữ số từ kết quả xổ số
const extractLotoNumbers = (lotteryResult) => {
  const lotoNumbers = [];
  
  if (!lotteryResult || !lotteryResult.results) return lotoNumbers;
  
  const results = lotteryResult.results;
  
  // Lấy từ giải đặc biệt
  if (results.gdb) {
    lotoNumbers.push(results.gdb.slice(-2));
  }
  
  // Lấy từ giải nhất
  if (results.g1) {
    lotoNumbers.push(results.g1.slice(-2));
  }
  
  // Lấy từ giải nhì
  if (results.g2 && Array.isArray(results.g2)) {
    results.g2.forEach(num => {
      if (num && num.length >= 2) {
        lotoNumbers.push(num.slice(-2));
      }
    });
  }
  
  // Lấy từ giải ba đến bảy
  ['g3', 'g4', 'g5', 'g6', 'g7'].forEach(prize => {
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

// Hàm đếm số lần xuất hiện của một số lô
const countLotoOccurrences = (lotoNumbers, targetNumber) => {
  return lotoNumbers.filter(num => num === targetNumber.padStart(2, '0')).length;
};

// Hàm tính thưởng cho lô
const calculateLotoPrize = async (invoiceItem, lotteryResult, storeId) => {
  const lotoNumbers = extractLotoNumbers(lotteryResult);
  console.log(`[PRIZE DEBUG] --> Các số lô trúng thưởng từ KQXS: [${lotoNumbers.join(', ')}]`);
  const prizeMultiplier = await getMultiplierByStore(storeId, 'loto');
  
  if (!prizeMultiplier) {
    throw new Error('Không tìm thấy hệ số thưởng cho lô');
  }
  
  let totalWinningPoints = 0;
  const winningDetails = [];
  
  if (invoiceItem.numbers) {
    const betNumbers = invoiceItem.numbers.split(/[\s,]+/).filter(n => n.length > 0);
    const betPoints = parseInt(invoiceItem.points) || 0;
    console.log(`[PRIZE DEBUG] ---> Các số lô đã cược: [${betNumbers.join(', ')}] với ${betPoints} điểm`);
    
    betNumbers.forEach(number => {
      const paddedNumber = number.padStart(2, '0');
      const occurrences = countLotoOccurrences(lotoNumbers, paddedNumber);
      console.log(`[PRIZE DEBUG] -----> Kiểm tra số ${paddedNumber}: trúng ${occurrences} lần.`);
      
      if (occurrences > 0) {
        const winningPoints = betPoints * occurrences;
        totalWinningPoints += winningPoints;
        winningDetails.push({
          number: paddedNumber,
          betPoints: betPoints,
          occurrences: occurrences,
          winningPoints: winningPoints
        });
      }
    });
  }
  
  if (totalWinningPoints > 0) {
    const perNumberStrings = winningDetails.map(d => `${d.number}x${d.occurrences}(${d.betPoints * d.occurrences}đ)`);
    const detailString = `${perNumberStrings.join(', ')} = ${totalWinningPoints}đ`;
    return {
      betType: 'loto',
      betTypeLabel: 'Lô tô',
      numbers: perNumberStrings.join(', '),
      betAmount: totalWinningPoints,
      winningCount: winningDetails.reduce((sum, d) => sum + d.occurrences, 0),
      multiplier: prizeMultiplier.multiplier,
      prizeAmount: totalWinningPoints * prizeMultiplier.multiplier * 1000, // x1000 để chuyển từ điểm sang VND
      detailString: detailString
    };
  }
  
  return null;
};

// Hàm tính thưởng cho 2 số (đề)
const calculate2sPrize = async (invoiceItem, lotteryResult, storeId) => {
  // Lấy 2 số cuối của giải đặc biệt
  const specialPrize = lotteryResult.results?.gdb || lotteryResult.specialPrize;
  if (!specialPrize) {
    return null;
  }
  
  const lastTwoDigits = specialPrize.slice(-2);
  console.log(`[PRIZE DEBUG] --> 2 số cuối giải đặc biệt: ${lastTwoDigits}`);
  
  const prizeMultiplier = await getMultiplierByStore(storeId, '2s');
  if (!prizeMultiplier) {
    throw new Error('Không tìm thấy hệ số thưởng cho 2 số');
  }
  
  let totalWinningAmount = 0;
  const winningDetails = [];
  let betNumbers = [];
  let betAmount = 0;
  
  if (invoiceItem.numbers) {
    betNumbers = invoiceItem.numbers.split(/[\s,]+/).filter(n => n.length > 0);
    betAmount = parseInt(invoiceItem.amount) || 0;
    console.log(`[PRIZE DEBUG] ---> Các số 2 số đã cược: [${betNumbers.join(', ')}] với ${betAmount} VNĐ`);
    
    betNumbers.forEach(number => {
      const paddedNumber = number.padStart(2, '0');
      if (paddedNumber === lastTwoDigits) {
        const winningAmount = betAmount * prizeMultiplier.multiplier * 1000;
        totalWinningAmount += winningAmount;
        winningDetails.push({
          number: paddedNumber,
          betAmount: betAmount,
          winningAmount: winningAmount
        });
        console.log(`[PRIZE DEBUG] -----> Số ${paddedNumber} trúng! Thưởng: ${winningAmount} VNĐ`);
      }
    });
  }
  
  if (totalWinningAmount > 0) {
    return {
      betType: '2s',
      betTypeLabel: '2 số (Đề)',
      numbers: betNumbers.join(', '),
      betAmount: betAmount,
      winningCount: winningDetails.length,
      multiplier: prizeMultiplier.multiplier,
      prizeAmount: totalWinningAmount,
      detailString: winningDetails.map(d => `${d.number}: ${d.betAmount}n x ${prizeMultiplier.multiplier} = ${d.winningAmount.toLocaleString('vi-VN')} đ`).join(', ')
    };
  }
  
  return null;
};

// Hàm tính tổng của 2 số
const calculateSum = (number) => {
  const digits = number.toString().padStart(2, '0').split('').map(Number);
  return (digits[0] + digits[1]) % 10;
};

// Hàm tính thưởng cho tổng
const calculateTongPrize = async (invoiceItem, lotteryResult, storeId) => {
  // Lấy 2 số cuối của giải đặc biệt
  const specialPrize = lotteryResult.results?.gdb || lotteryResult.specialPrize;
  if (!specialPrize) {
    return null;
  }
  
  const lastTwoDigits = specialPrize.slice(-2);
  const resultSum = calculateSum(lastTwoDigits);
  console.log(`[PRIZE DEBUG] --> 2 số cuối giải đặc biệt: ${lastTwoDigits}, tổng: ${resultSum}`);
  
  const prizeMultiplier = await getMultiplierByStore(storeId, 'tong');
  if (!prizeMultiplier) {
    throw new Error('Không tìm thấy hệ số thưởng cho tổng');
  }
  
  let totalWinningAmount = 0;
  const winningDetails = [];
  let betSums = [];
  let betAmount = 0;
  
  if (invoiceItem.numbers) {
    betSums = invoiceItem.numbers.split(/[\s,]+/).filter(n => n.length > 0);
    betAmount = parseInt(invoiceItem.amount) || 0;
    console.log(`[PRIZE DEBUG] ---> Các tổng đã cược: [${betSums.join(', ')}] với ${betAmount} VNĐ`);
    
    betSums.forEach(sum => {
      const betSum = parseInt(sum);
      if (betSum === resultSum) {
        const winningAmount = betAmount * prizeMultiplier.multiplier * 1000;
        totalWinningAmount += winningAmount;
        winningDetails.push({
          sum: betSum,
          betAmount: betAmount,
          winningAmount: winningAmount
        });
        console.log(`[PRIZE DEBUG] -----> Tổng ${betSum} trúng! Thưởng: ${winningAmount} VNĐ`);
      }
    });
  }
  
  if (totalWinningAmount > 0) {
    return {
      betType: 'tong',
      betTypeLabel: 'Tổng',
      numbers: betSums.join(', '),
      betAmount: betAmount,
      winningCount: winningDetails.length,
      multiplier: prizeMultiplier.multiplier,
      prizeAmount: totalWinningAmount,
      detailString: winningDetails.map(d => `Tổng ${d.sum}: ${d.betAmount}n x ${prizeMultiplier.multiplier} = ${d.winningAmount.toLocaleString('vi-VN')} đ`).join(', ')
    };
  }
  
  return null;
};

// Hàm tính thưởng cho xiên quay 3 và 4
const calculateXienQuayPrize = async (invoiceItem, lotteryResult, storeId) => {
  const betAmount = parseInt(invoiceItem.amount) || 0;
  if (betAmount === 0) {
    return null;
  }

  // Lấy tất cả giải từ đặc biệt đến giải 7
  const allPrizes = [];
  if (lotteryResult.results) {
    if (lotteryResult.results.gdb) allPrizes.push(lotteryResult.results.gdb);
    if (lotteryResult.results.g1) allPrizes.push(lotteryResult.results.g1);
    if (lotteryResult.results.g2) allPrizes.push(...lotteryResult.results.g2);
    if (lotteryResult.results.g3) allPrizes.push(...lotteryResult.results.g3);
    if (lotteryResult.results.g4) allPrizes.push(...lotteryResult.results.g4);
    if (lotteryResult.results.g5) allPrizes.push(...lotteryResult.results.g5);
    if (lotteryResult.results.g6) allPrizes.push(...lotteryResult.results.g6);
    if (lotteryResult.results.g7) allPrizes.push(...lotteryResult.results.g7);
  }

  // Lấy 2 số cuối của tất cả giải
  const winningNumbers = allPrizes.map(prize => prize.slice(-2));

  console.log(`[XIENQUAY DEBUG] --> Tất cả 2 số cuối các giải: [${winningNumbers.join(', ')}]`);

  // Tách các xiên quay riêng biệt nếu có dấu phẩy
  let xienquayCombinations = [];
  if (invoiceItem.numbers) {
    if (invoiceItem.numbers.includes(',')) {
      // Có nhiều xiên quay trên cùng một dòng
      xienquayCombinations = invoiceItem.numbers.split(',').map(s => s.trim());
      console.log(`[XIENQUAY DEBUG] ---> Tách thành ${xienquayCombinations.length} xiên quay riêng biệt: [${xienquayCombinations.join('], [')}]`);
    } else {
      // Chỉ có một xiên quay
      xienquayCombinations = [invoiceItem.numbers];
      console.log(`[XIENQUAY DEBUG] ---> Một xiên quay duy nhất: [${invoiceItem.numbers}]`);
    }
  }

  const totalWinnings = [];
  let totalPrizeAmount = 0;

  for (let i = 0; i < xienquayCombinations.length; i++) {
    const xienquayString = xienquayCombinations[i];
    const betNumbers = xienquayString.split(/[\s,-]+/).filter(n => n.length > 0);
    
    console.log(`[XIENQUAY DEBUG] ---> Xử lý xiên quay ${i + 1}: [${betNumbers.join(', ')}] với ${betAmount} VNĐ`);

    const n = betNumbers.length;
    if (n !== 3 && n !== 4) {
      console.log(`[XIENQUAY DEBUG] ---> Xiên quay ${i + 1}: Chỉ hỗ trợ xiên quay 3 hoặc 4, nhận được ${n} số`);
      continue;
    }

    // Sinh tất cả tổ hợp
    const allCombinations = generateXienQuayCombinations(betNumbers);
    console.log(`[XIENQUAY DEBUG] ---> Xiên quay ${i + 1}: Sinh ${allCombinations.length} tổ hợp từ ${n} số`);

    // Kiểm tra từng tổ hợp xem có trúng không
    const winningCombinations = [];
    
    for (const combo of allCombinations) {
      const comboLength = combo.length;
      
      if (comboLength === 2) {
        // Kiểm tra cặp 2 số: cần cả 2 số đều xuất hiện ở 2 số cuối các giải
        const [num1, num2] = combo;
        const num1Wins = winningNumbers.includes(num1);
        const num2Wins = winningNumbers.includes(num2);
        
        if (num1Wins && num2Wins) {
          winningCombinations.push({
            combination: combo,
            type: '2 số',
            length: 2
          });
          console.log(`[XIENQUAY DEBUG] -----> Trúng cặp: ${combo.join('-')} (${num1}✓, ${num2}✓)`);
        } else {
          console.log(`[XIENQUAY DEBUG] -----> Không trúng: ${combo.join('-')} (${num1}${num1Wins?'✓':'✗'}, ${num2}${num2Wins?'✓':'✗'})`);
        }
      } else if (comboLength === 3) {
        // Xiên quay 3 số - kiểm tra tất cả cặp con
        const pairs = getCombinations(combo, 2);
        let matchCount = 0;
        
        for (const pair of pairs) {
          const [num1, num2] = pair;
          const num1Wins = winningNumbers.includes(num1);
          const num2Wins = winningNumbers.includes(num2);
          
          if (num1Wins && num2Wins) {
            matchCount++;
          }
        }
        
        if (matchCount >= 3) {
          // Trúng cả 3 cặp
          winningCombinations.push({
            combination: combo,
            type: '3 số',
            length: 3,
            matchCount: 3
          });
          console.log(`[XIENQUAY DEBUG] -----> Trúng cả 3 cặp: ${combo.join('-')}`);
        } else if (matchCount >= 2) {
          // Trúng 2 cặp
          winningCombinations.push({
            combination: combo,
            type: '3 số',
            length: 3,
            matchCount: 2
          });
          console.log(`[XIENQUAY DEBUG] -----> Trúng 2 cặp: ${combo.join('-')}`);
        }
      } else if (comboLength === 4) {
        // Xiên quay 4 số - kiểm tra tất cả cặp con
        const pairs = getCombinations(combo, 2);
        let matchCount = 0;
        
        for (const pair of pairs) {
          const [num1, num2] = pair;
          const num1Wins = winningNumbers.includes(num1);
          const num2Wins = winningNumbers.includes(num2);
          
          if (num1Wins && num2Wins) {
            matchCount++;
          }
        }
        
        if (matchCount >= 4) {
          // Trúng cả 4 cặp
          winningCombinations.push({
            combination: combo,
            type: '4 số',
            length: 4,
            matchCount: 4
          });
          console.log(`[XIENQUAY DEBUG] -----> Trúng cả 4 cặp: ${combo.join('-')}`);
        } else if (matchCount >= 3) {
          // Trúng 3 cặp
          winningCombinations.push({
            combination: combo,
            type: '4 số',
            length: 4,
            matchCount: 3
          });
          console.log(`[XIENQUAY DEBUG] -----> Trúng 3 cặp: ${combo.join('-')}`);
        } else if (matchCount >= 2) {
          // Trúng 2 cặp
          winningCombinations.push({
            combination: combo,
            type: '4 số',
            length: 4,
            matchCount: 2
          });
          console.log(`[XIENQUAY DEBUG] -----> Trúng 2 cặp: ${combo.join('-')}`);
        }
      }
    }

    if (winningCombinations.length === 0) {
      console.log(`[XIENQUAY DEBUG] ---> Xiên quay ${i + 1}: Không có tổ hợp nào trúng`);
      continue;
    }

    // Tìm tổ hợp trúng cao nhất
    let bestCombination = null;
    let bestMultiplier = 0;
    let bestBetType = '';
    let bestDescription = '';

    for (const combo of winningCombinations) {
      let multiplier = 0;
      let betType = '';
      let description = '';

      if (combo.length === 2) {
        // Xiên quay 2 số
        multiplier = 12;
        
        betType = 'xienquay2';
        description = `Xiên quay ${betNumbers.length} số trúng 2 con`;
      } else if (combo.length === 3) {
        if (combo.matchCount === 3) {
          // Xiên quay 3 số - trúng cả 3 cặp
          const multiplierData = await getMultiplierByStore(storeId, 'xienquay3_full');
          if (multiplierData) {
            multiplier = multiplierData.multiplier;
            betType = 'xienquay3_full';
            description = `Xiên quay ${betNumbers.length} - Trúng cả 3 con`;
          }
        } else if (combo.matchCount === 2) {
          // Xiên quay 3 số - trúng 2 cặp
          const multiplierData = await getMultiplierByStore(storeId, 'xienquay3_2con');
          if (multiplierData) {
            multiplier = multiplierData.multiplier;
            betType = 'xienquay3_2con';
            description = `Xiên quay ${betNumbers.length} - Trúng 2 con`;
          }
        }
      } else if (combo.length === 4) {
        if (combo.matchCount === 4) {
          // Xiên quay 4 số - trúng cả 4 cặp
          const multiplierData = await getMultiplierByStore(storeId, 'xienquay4_full');
          if (multiplierData) {
            multiplier = multiplierData.multiplier;
            betType = 'xienquay4_full';
            description = `Xiên quay ${betNumbers.length} - Trúng cả 4 con`;
          }
        } else if (combo.matchCount === 3) {
          // Xiên quay 4 số - trúng 3 cặp
          const multiplierData = await getMultiplierByStore(storeId, 'xienquay4_3con');
          if (multiplierData) {
            multiplier = multiplierData.multiplier;
            betType = 'xienquay4_3con';
            description = `Xiên quay ${betNumbers.length} - Trúng 3 con`;
          }
        } else if (combo.matchCount === 2) {
          // Xiên quay 4 số - trúng 2 cặp
          const multiplierData = await getMultiplierByStore(storeId, 'xienquay4_2con');
          if (multiplierData) {
            multiplier = multiplierData.multiplier;
            betType = 'xienquay4_2con';
            description = `Xiên quay ${betNumbers.length} - Trúng 2 con`;
          }
        }
      }

      if (multiplier > bestMultiplier) {
        bestMultiplier = multiplier;
        bestCombination = combo;
        bestBetType = betType;
        bestDescription = description;
      }
    }

    if (bestMultiplier > 0) {
      const winningAmount = betAmount * bestMultiplier * 1000;
      totalPrizeAmount += winningAmount;
      
      totalWinnings.push({
        betType: bestBetType,
        betTypeLabel: bestDescription,
        numbers: xienquayString, // Lưu tất cả số đã đánh ban đầu
        winningNumbers: bestCombination.combination.join(', '), // Lưu các số trúng thưởng
        betAmount: betAmount,
        winningCount: bestCombination.matchCount || bestCombination.length,
        multiplier: bestMultiplier,
        prizeAmount: winningAmount,
        detailString: `${bestDescription}: ${betAmount}n x ${bestMultiplier} = ${winningAmount.toLocaleString('vi-VN')} đ`
      });
      
      console.log(`[XIENQUAY DEBUG] ---> Xiên quay ${i + 1} trúng! Thưởng: ${winningAmount} VNĐ`);
    }
  }

  if (totalWinnings.length > 0) {
    // Trả về array các winning items riêng biệt cho mỗi xiên quay trúng
    return totalWinnings;
  }

  return null;
};

// Hàm tính thưởng cho xiên (không phải xiên quay)
const calculateXienPrize = async (invoiceItem, lotteryResult, storeId) => {
  const betAmount = parseInt(invoiceItem.amount) || 0;
  if (betAmount === 0) {
    return null;
  }

  // Lấy tất cả giải từ đặc biệt đến giải 7
  const allPrizes = [];
  if (lotteryResult.results) {
    if (lotteryResult.results.gdb) allPrizes.push(lotteryResult.results.gdb);
    if (lotteryResult.results.g1) allPrizes.push(lotteryResult.results.g1);
    if (lotteryResult.results.g2) allPrizes.push(...lotteryResult.results.g2);
    if (lotteryResult.results.g3) allPrizes.push(...lotteryResult.results.g3);
    if (lotteryResult.results.g4) allPrizes.push(...lotteryResult.results.g4);
    if (lotteryResult.results.g5) allPrizes.push(...lotteryResult.results.g5);
    if (lotteryResult.results.g6) allPrizes.push(...lotteryResult.results.g6);
    if (lotteryResult.results.g7) allPrizes.push(...lotteryResult.results.g7);
  }

  // Lấy 2 số cuối của tất cả giải
  const winningNumbers = allPrizes.map(prize => prize.slice(-2));
  
  // Đếm số lần xuất hiện của mỗi số
  const numberCounts = {};
  winningNumbers.forEach(num => {
    numberCounts[num] = (numberCounts[num] || 0) + 1;
  });

  console.log(`[XIEN DEBUG] --> Tất cả 2 số cuối các giải: [${winningNumbers.join(', ')}]`);
  console.log(`[XIEN DEBUG] --> Số lần xuất hiện:`, numberCounts);

  // Tách các xiên riêng biệt nếu có dấu phẩy
  let xienCombinations = [];
  if (invoiceItem.numbers) {
    if (invoiceItem.numbers.includes(',')) {
      // Có nhiều xiên trên cùng một dòng
      xienCombinations = invoiceItem.numbers.split(',').map(s => s.trim());
      console.log(`[XIEN DEBUG] ---> Tách thành ${xienCombinations.length} xiên riêng biệt: [${xienCombinations.join('], [')}]`);
    } else {
      // Chỉ có một xiên
      xienCombinations = [invoiceItem.numbers];
      console.log(`[XIEN DEBUG] ---> Một xiên duy nhất: [${invoiceItem.numbers}]`);
    }
  }

  const totalWinnings = [];
  let totalPrizeAmount = 0;

  for (let i = 0; i < xienCombinations.length; i++) {
    const xienString = xienCombinations[i];
    const betNumbers = xienString.split(/[\s,-]+/).filter(n => n.length > 0);
    
    console.log(`[XIEN DEBUG] ---> Xử lý xiên ${i + 1}: [${betNumbers.join(', ')}] với ${betAmount} VNĐ`);

    const n = betNumbers.length;
    if (n < 2 || n > 4) {
      console.log(`[XIEN DEBUG] ---> Xiên ${i + 1}: Chỉ hỗ trợ xiên 2, 3, 4, nhận được ${n} số`);
      continue;
    }

    // Kiểm tra số trúng và số lần xuất hiện
    const hitNumbers = [];
    const multiHitNumbers = []; // Số xuất hiện ≥2 lần
    
    for (const num of betNumbers) {
      const paddedNum = num.padStart(2, '0');
      const count = numberCounts[paddedNum] || 0;
      
      if (count > 0) {
        hitNumbers.push({ number: paddedNum, count });
        if (count >= 2) {
          multiHitNumbers.push(paddedNum);
        }
        console.log(`[XIEN DEBUG] -----> Số ${paddedNum} trúng ${count} lần`);
      } else {
        console.log(`[XIEN DEBUG] -----> Số ${paddedNum} không trúng`);
      }
    }

    const hitCount = hitNumbers.length;
    const multiHitCount = multiHitNumbers.length;
    
    console.log(`[XIEN DEBUG] ---> Xiên ${i + 1}: Trúng ${hitCount}/${n} số, trong đó ${multiHitCount} số ≥2 nháy`);

    if (hitCount === 0) {
      console.log(`[XIEN DEBUG] ---> Xiên ${i + 1}: Không có số nào trúng`);
      continue;
    }

    // Tính thưởng theo quy tắc
    let bestMultiplier = 0;
    let bestDescription = '';
    let bestBetType = '';

    if (n === 2) {
      // Xiên 2
      if (hitCount === 2) {
        // Trúng cả 2 số
        const multiplierData = await getMultiplierByStore(storeId, 'xien2_full');
        if (multiplierData) {
          bestMultiplier = multiplierData.multiplier;
          bestDescription = 'Xiên 2 - Trúng cả 2 số';
          bestBetType = 'xien2_full';
        }
      } else if (hitCount === 1 && multiHitCount >= 1) {
        // Trúng 1 số và về ≥2 nháy
        const multiplierData = await getMultiplierByStore(storeId, 'xien2_1hit');
        if (multiplierData) {
          bestMultiplier = multiplierData.multiplier;
          bestDescription = 'Xiên 2 - Trúng 1 số (≥2 nháy)';
          bestBetType = 'xien2_1hit';
        }
      }
    } else if (n === 3) {
      // Xiên 3
      if (hitCount === 3) {
        // Trúng cả 3 số
        const multiplierData = await getMultiplierByStore(storeId, 'xien3_full');
        if (multiplierData) {
          bestMultiplier = multiplierData.multiplier;
          bestDescription = 'Xiên 3 - Trúng cả 3 số';
          bestBetType = 'xien3_full';
        }
      } else if (hitCount === 2) {
        if (multiHitCount === 2) {
          // Trúng 2 số và cả 2 đều ≥2 nháy
          const multiplierData = await getMultiplierByStore(storeId, 'xien3_2hit_both');
          if (multiplierData) {
            bestMultiplier = multiplierData.multiplier;
            bestDescription = 'Xiên 3 - Trúng 2 số (cả 2 ≥2 nháy)';
            bestBetType = 'xien3_2hit_both';
          }
        } else if (multiHitCount >= 1) {
          // Trúng 2 số và 1 trong 2 ≥2 nháy
          const multiplierData = await getMultiplierByStore(storeId, 'xien3_2hit_one');
          if (multiplierData) {
            bestMultiplier = multiplierData.multiplier;
            bestDescription = 'Xiên 3 - Trúng 2 số (1 số ≥2 nháy)';
            bestBetType = 'xien3_2hit_one';
          }
        }
      }
    } else if (n === 4) {
      // Xiên 4
      if (hitCount === 4) {
        // Trúng cả 4 số
        const multiplierData = await getMultiplierByStore(storeId, 'xien4_full');
        if (multiplierData) {
          bestMultiplier = multiplierData.multiplier;
          bestDescription = 'Xiên 4 - Trúng cả 4 số';
          bestBetType = 'xien4_full';
        }
      } else if (hitCount === 3) {
        if (multiHitCount === 3) {
          // Trúng 3 số và cả 3 đều ≥2 nháy
          const multiplierData = await getMultiplierByStore(storeId, 'xien4_3hit_all');
          if (multiplierData) {
            bestMultiplier = multiplierData.multiplier;
            bestDescription = 'Xiên 4 - Trúng 3 số (cả 3 ≥2 nháy)';
            bestBetType = 'xien4_3hit_all';
          }
        } else if (multiHitCount === 2) {
          // Trúng 3 số và 2 trong 3 ≥2 nháy
          const multiplierData = await getMultiplierByStore(storeId, 'xien4_3hit_two');
          if (multiplierData) {
            bestMultiplier = multiplierData.multiplier;
            bestDescription = 'Xiên 4 - Trúng 3 số (2 số ≥2 nháy)';
            bestBetType = 'xien4_3hit_two';
          }
        } else if (multiHitCount >= 1) {
          // Trúng 3 số và 1 trong 3 ≥2 nháy
          const multiplierData = await getMultiplierByStore(storeId, 'xien4_3hit_one');
          if (multiplierData) {
            bestMultiplier = multiplierData.multiplier;
            bestDescription = 'Xiên 4 - Trúng 3 số (1 số ≥2 nháy)';
            bestBetType = 'xien4_3hit_one';
          }
        }
      }
    }

    if (bestMultiplier > 0) {
      const winningAmount = betAmount * bestMultiplier * 1000;
      totalPrizeAmount += winningAmount;
      
      totalWinnings.push({
        betType: bestBetType,
        betTypeLabel: `Xiên ${n}`,
        numbers: betNumbers.join(', '),
        betAmount: betAmount,
        winningCount: hitCount,
        multiplier: bestMultiplier,
        prizeAmount: winningAmount,
        detailString: `${bestDescription}: ${betAmount}n x ${bestMultiplier} = ${winningAmount.toLocaleString('vi-VN')} đ`
      });
      
      console.log(`[XIEN DEBUG] ---> Xiên ${i + 1} trúng! Thưởng: ${winningAmount} VNĐ`);
    }
  }

  if (totalWinnings.length > 0) {
    // Trả về array các winning items riêng biệt cho mỗi xiên trúng
    return totalWinnings;
  }

  return null;
};

// Hàm tính thưởng cho đầu
const calculateDauPrize = async (invoiceItem, lotteryResult, storeId) => {
  // Lấy 2 số cuối của giải đặc biệt
  const specialPrize = lotteryResult.results?.gdb || lotteryResult.specialPrize;
  if (!specialPrize) {
    return null;
  }
  
  const lastTwoDigits = specialPrize.slice(-2);
  const firstDigit = parseInt(lastTwoDigits.charAt(0));
  console.log(`[PRIZE DEBUG] --> 2 số cuối giải đặc biệt: ${lastTwoDigits}, đầu: ${firstDigit}`);
  
  const prizeMultiplier = await getMultiplierByStore(storeId, 'dau');
  if (!prizeMultiplier) {
    throw new Error('Không tìm thấy hệ số thưởng cho đầu');
  }
  
  let totalWinningAmount = 0;
  const winningDetails = [];
  let betHeads = [];
  let betAmount = 0;
  
  if (invoiceItem.numbers) {
    betHeads = invoiceItem.numbers.split(/[\s,]+/).filter(n => n.length > 0);
    betAmount = parseInt(invoiceItem.amount) || 0;
    console.log(`[PRIZE DEBUG] ---> Các đầu đã cược: [${betHeads.join(', ')}] với ${betAmount} VNĐ`);
    
    betHeads.forEach(head => {
      const betHead = parseInt(head);
      if (betHead === firstDigit) {
        const winningAmount = betAmount * prizeMultiplier.multiplier * 1000;
        totalWinningAmount += winningAmount;
        winningDetails.push({
          head: betHead,
          betAmount: betAmount,
          winningAmount: winningAmount
        });
        console.log(`[PRIZE DEBUG] -----> Đầu ${betHead} trúng! Thưởng: ${winningAmount} VNĐ`);
      }
    });
  }
  
  if (totalWinningAmount > 0) {
    return {
      betType: 'dau',
      betTypeLabel: 'Đầu',
      numbers: betHeads.join(', '),
      betAmount: betAmount,
      winningCount: winningDetails.length,
      multiplier: prizeMultiplier.multiplier,
      prizeAmount: totalWinningAmount,
      detailString: winningDetails.map(d => `Đầu ${d.head}: ${d.betAmount}n x ${prizeMultiplier.multiplier} = ${d.winningAmount.toLocaleString('vi-VN')} đ`).join(', ')
    };
  }
  
  return null;
};

// Hàm tính thưởng cho đít
const calculateDitPrize = async (invoiceItem, lotteryResult, storeId) => {
  // Lấy 2 số cuối của giải đặc biệt
  const specialPrize = lotteryResult.results?.gdb || lotteryResult.specialPrize;
  if (!specialPrize) {
    return null;
  }
  
  const lastTwoDigits = specialPrize.slice(-2);
  const lastDigit = parseInt(lastTwoDigits.charAt(1));
  console.log(`[PRIZE DEBUG] --> 2 số cuối giải đặc biệt: ${lastTwoDigits}, đít: ${lastDigit}`);
  
  const prizeMultiplier = await getMultiplierByStore(storeId, 'dit');
  if (!prizeMultiplier) {
    throw new Error('Không tìm thấy hệ số thưởng cho đít');
  }
  
  let totalWinningAmount = 0;
  const winningDetails = [];
  let betTails = [];
  let betAmount = 0;
  
  if (invoiceItem.numbers) {
    betTails = invoiceItem.numbers.split(/[\s,]+/).filter(n => n.length > 0);
    betAmount = parseInt(invoiceItem.amount) || 0;
    console.log(`[PRIZE DEBUG] ---> Các đít đã cược: [${betTails.join(', ')}] với ${betAmount} VNĐ`);
    
    betTails.forEach(tail => {
      const betTail = parseInt(tail);
      if (betTail === lastDigit) {
        const winningAmount = betAmount * prizeMultiplier.multiplier * 1000;
        totalWinningAmount += winningAmount;
        winningDetails.push({
          tail: betTail,
          betAmount: betAmount,
          winningAmount: winningAmount
        });
        console.log(`[PRIZE DEBUG] -----> Đít ${betTail} trúng! Thưởng: ${winningAmount} VNĐ`);
      }
    });
  }
  
  if (totalWinningAmount > 0) {
    return {
      betType: 'dit',
      betTypeLabel: 'Đít',
      numbers: betTails.join(', '),
      betAmount: betAmount,
      winningCount: winningDetails.length,
      multiplier: prizeMultiplier.multiplier,
      prizeAmount: totalWinningAmount,
      detailString: winningDetails.map(d => `Đít ${d.tail}: ${d.betAmount}n x ${prizeMultiplier.multiplier} = ${d.winningAmount.toLocaleString('vi-VN')} đ`).join(', ')
    };
  }
  
  return null;
};

// Hàm tính thưởng cho kép
const calculateKepPrize = async (invoiceItem, lotteryResult, storeId) => {
  // Lấy 2 số cuối của giải đặc biệt
  const specialPrize = lotteryResult.results?.gdb || lotteryResult.specialPrize;
  if (!specialPrize) {
    return null;
  }
  
  const lastTwoDigits = specialPrize.slice(-2);
  console.log(`[PRIZE DEBUG] --> 2 số cuối giải đặc biệt: ${lastTwoDigits}`);
  
  // Định nghĩa kép bằng và kép lệch
  const kepBang = ['00', '11', '22', '33', '44', '55', '66', '77', '88', '99'];
  const kepLech = ['05', '50', '16', '61', '27', '72', '38', '83', '49', '94'];
  
  const prizeMultiplier = await getMultiplierByStore(storeId, 'kep');
  if (!prizeMultiplier) {
    throw new Error('Không tìm thấy hệ số thưởng cho kép');
  }
  
  let totalWinningAmount = 0;
  const winningDetails = [];
  let betKeps = [];
  let betAmount = 0;
  
  if (invoiceItem.numbers) {
    betKeps = invoiceItem.numbers.split(/[\s,]+/).filter(n => n.length > 0);
    betAmount = parseInt(invoiceItem.amount) || 0;
    console.log(`[PRIZE DEBUG] ---> Các kép đã cược: [${betKeps.join(', ')}] với ${betAmount} VNĐ`);
    
    betKeps.forEach(kep => {
      const kepType = kep.toLowerCase();
      let isWinning = false;
      
      console.log(`[PRIZE DEBUG] -----> Kiểm tra kép: '${kepType}'`);
      
      if (kepType === 'bằng' && kepBang.includes(lastTwoDigits)) {
        isWinning = true;
        console.log(`[PRIZE DEBUG] -----> Kép bằng trúng! Đề về: ${lastTwoDigits}`);
      } else if (kepType === 'lệch' && kepLech.includes(lastTwoDigits)) {
        isWinning = true;
        console.log(`[PRIZE DEBUG] -----> Kép lệch trúng! Đề về: ${lastTwoDigits}`);
      } else {
        console.log(`[PRIZE DEBUG] -----> Không trúng. Đề về: ${lastTwoDigits}`);
      }
      
      if (isWinning) {
        const winningAmount = betAmount * prizeMultiplier.multiplier * 1000;
        totalWinningAmount += winningAmount;
        winningDetails.push({
          kep: kepType,
          betAmount: betAmount,
          winningAmount: winningAmount
        });
        console.log(`[PRIZE DEBUG] -----> ${kepType} trúng! Thưởng: ${winningAmount} VNĐ`);
      }
    });
  }
  
  if (totalWinningAmount > 0) {
    return {
      betType: 'kep',
      betTypeLabel: 'Kép',
      numbers: betKeps.join(', '),
      betAmount: betAmount,
      winningCount: winningDetails.length,
      multiplier: prizeMultiplier.multiplier,
      prizeAmount: totalWinningAmount,
      detailString: winningDetails.map(d => `${d.kep}: ${d.betAmount}n x ${prizeMultiplier.multiplier} = ${d.winningAmount.toLocaleString('vi-VN')} đ`).join(', ')
    };
  }
  
  return null;
};

// Hàm tính thưởng cho bộ
const calculateBoPrize = async (invoiceItem, lotteryResult, storeId) => {
  // Lấy 2 số cuối của giải đặc biệt
  const specialPrize = lotteryResult.results?.gdb || lotteryResult.specialPrize;
  if (!specialPrize) {
    return null;
  }
  
  const lastTwoDigits = specialPrize.slice(-2);
  console.log(`[PRIZE DEBUG] --> 2 số cuối giải đặc biệt: ${lastTwoDigits}`);
  
  // Định nghĩa 100 bộ
  const BO_DATA = {
    '00': ['00', '05', '50', '55'],
    '01': ['01', '10', '06', '60', '51', '15', '56', '65'],
    '02': ['02', '20', '07', '70', '52', '25', '57', '75'],
    '03': ['03', '30', '08', '80', '53', '35', '58', '85'],
    '04': ['04', '40', '09', '90', '54', '45', '59', '95'],
    '05': ['05', '50', '00', '55'],
    '06': ['06', '60', '01', '10', '56', '65', '51', '15'],
    '07': ['07', '70', '02', '20', '57', '75', '52', '25'],
    '08': ['08', '80', '03', '30', '58', '85', '53', '35'],
    '09': ['09', '90', '04', '40', '59', '95', '54', '45'],
    '10': ['10', '01', '15', '51', '60', '06', '65', '56'],
    '11': ['11', '16', '61', '66'],
    '12': ['12', '21', '17', '71', '62', '26', '67', '76'],
    '13': ['13', '31', '18', '81', '63', '36', '68', '86'],
    '14': ['14', '41', '19', '91', '64', '46', '69', '96'],
    '15': ['15', '51', '10', '01', '65', '56', '60', '06'],
    '16': ['16', '61', '11', '66'],
    '17': ['17', '71', '12', '21', '67', '76', '62', '26'],
    '18': ['18', '81', '13', '31', '68', '86', '63', '36'],
    '19': ['19', '91', '14', '41', '69', '96', '64', '46'],
    '20': ['20', '02', '25', '52', '70', '07', '75', '57'],
    '21': ['21', '12', '26', '62', '71', '17', '76', '67'],
    '22': ['22', '27', '72', '77'],
    '23': ['23', '32', '28', '82', '73', '37', '78', '87'],
    '24': ['24', '42', '29', '92', '74', '47', '79', '97'],
    '25': ['25', '52', '20', '02', '75', '57', '70', '07'],
    '26': ['26', '62', '21', '12', '76', '67', '71', '17'],
    '27': ['27', '72', '22', '77'],
    '28': ['28', '82', '23', '32', '78', '87', '73', '37'],
    '29': ['29', '92', '24', '42', '79', '97', '74', '47'],
    '30': ['30', '03', '35', '53', '80', '08', '85', '58'],
    '31': ['31', '13', '36', '63', '81', '18', '86', '68'],
    '32': ['32', '23', '37', '73', '82', '28', '87', '78'],
    '33': ['33', '38', '83', '88'],
    '34': ['34', '43', '39', '93', '84', '48', '89', '98'],
    '35': ['35', '53', '30', '03', '85', '58', '80', '08'],
    '36': ['36', '63', '31', '13', '86', '68', '81', '18'],
    '37': ['37', '73', '32', '23', '87', '78', '82', '28'],
    '38': ['38', '83', '33', '88'],
    '39': ['39', '93', '34', '43', '89', '98', '84', '48'],
    '40': ['40', '04', '45', '54', '90', '09', '95', '59'],
    '41': ['41', '14', '46', '64', '91', '19', '96', '69'],
    '42': ['42', '24', '47', '74', '92', '29', '97', '79'],
    '43': ['43', '34', '48', '84', '93', '39', '98', '89'],
    '44': ['44', '49', '94', '99'],
    '45': ['45', '54', '40', '04', '95', '59', '90', '09'],
    '46': ['46', '64', '41', '14', '96', '69', '91', '19'],
    '47': ['47', '74', '42', '24', '97', '79', '92', '29'],
    '48': ['48', '84', '43', '34', '98', '89', '93', '39'],
    '49': ['49', '94', '44', '99'],
    '50': ['50', '05', '55', '00'],
    '51': ['51', '15', '56', '65', '01', '10', '06', '60'],
    '52': ['52', '25', '57', '75', '02', '20', '07', '70'],
    '53': ['53', '35', '58', '85', '03', '30', '08', '80'],
    '54': ['54', '45', '59', '95', '04', '40', '09', '90'],
    '55': ['55', '50', '05', '00'],
    '56': ['56', '65', '51', '15', '06', '60', '01', '10'],
    '57': ['57', '75', '52', '25', '07', '70', '02', '20'],
    '58': ['58', '85', '53', '35', '08', '80', '03', '30'],
    '59': ['59', '95', '54', '45', '09', '90', '04', '40'],
    '60': ['60', '06', '65', '56', '10', '01', '15', '51'],
    '61': ['61', '16', '66', '11'],
    '62': ['62', '26', '67', '76', '12', '21', '17', '71'],
    '63': ['63', '36', '68', '86', '13', '31', '18', '81'],
    '64': ['64', '46', '69', '96', '14', '41', '19', '91'],
    '65': ['65', '56', '60', '06', '15', '51', '10', '01'],
    '66': ['66', '61', '16', '11'],
    '67': ['67', '76', '62', '26', '17', '71', '12', '21'],
    '68': ['68', '86', '63', '36', '18', '81', '13', '31'],
    '69': ['69', '96', '64', '46', '19', '91', '14', '41'],
    '70': ['70', '07', '75', '57', '20', '02', '25', '52'],
    '71': ['71', '17', '76', '67', '21', '12', '26', '62'],
    '72': ['72', '27', '77', '22'],
    '73': ['73', '37', '78', '87', '23', '32', '28', '82'],
    '74': ['74', '47', '79', '97', '24', '42', '29', '92'],
    '75': ['75', '57', '70', '07', '25', '52', '20', '02'],
    '76': ['76', '67', '71', '17', '26', '62', '21', '12'],
    '77': ['77', '72', '27', '22'],
    '78': ['78', '87', '73', '37', '28', '82', '23', '32'],
    '79': ['79', '97', '74', '47', '29', '92', '24', '42'],
    '80': ['80', '08', '85', '58', '30', '03', '35', '53'],
    '81': ['81', '18', '86', '68', '31', '13', '36', '63'],
    '82': ['82', '28', '87', '78', '32', '23', '37', '73'],
    '83': ['83', '38', '88', '33'],
    '84': ['84', '48', '89', '98', '34', '43', '39', '93'],
    '85': ['85', '58', '80', '08', '35', '53', '30', '03'],
    '86': ['86', '68', '81', '18', '36', '63', '31', '13'],
    '87': ['87', '78', '82', '28', '37', '73', '32', '23'],
    '88': ['88', '83', '38', '33'],
    '89': ['89', '98', '84', '48', '39', '93', '34', '43'],
    '90': ['90', '09', '95', '59', '40', '04', '45', '54'],
    '91': ['91', '19', '96', '69', '41', '14', '46', '64'],
    '92': ['92', '29', '97', '79', '42', '24', '47', '74'],
    '93': ['93', '39', '98', '89', '43', '34', '48', '84'],
    '94': ['94', '49', '99', '44'],
    '95': ['95', '59', '90', '09', '45', '54', '40', '04'],
    '96': ['96', '69', '91', '19', '46', '64', '41', '14'],
    '97': ['97', '79', '92', '29', '47', '74', '42', '24'],
    '98': ['98', '89', '93', '39', '48', '84', '43', '34'],
    '99': ['99', '94', '49', '44'],
    // Các bộ chẵn lẻ
    'chanle': ['01', '03', '05', '07', '09', '21', '23', '25', '27', '29', '41', '43', '45', '47', '49', '61', '63', '65', '67', '69', '81', '83', '85', '87', '89'],
    'lechan': ['10', '12', '14', '16', '18', '30', '32', '34', '36', '38', '50', '52', '54', '56', '58', '70', '72', '74', '76', '78', '90', '92', '94', '96', '98'],
    'lele': ['11', '13', '15', '17', '19', '31', '33', '35', '37', '39', '51', '53', '55', '57', '59', '71', '73', '75', '77', '79', '91', '93', '95', '97', '99'],
    'chanchan': ['00', '02', '04', '06', '08', '20', '22', '24', '26', '28', '40', '42', '44', '46', '48', '60', '62', '64', '66', '68', '80', '82', '84', '86', '88']
  };
  
  const prizeMultiplier = await getMultiplierByStore(storeId, 'bo');
  if (!prizeMultiplier) {
    throw new Error('Không tìm thấy hệ số thưởng cho bộ');
  }
  
  let totalWinningAmount = 0;
  const winningDetails = [];
  let betBos = [];
  let betAmount = 0;
  
  if (invoiceItem.numbers) {
    betAmount = parseInt(invoiceItem.amount) || 0;
    console.log(`[PRIZE DEBUG] ---> Dữ liệu bộ: "${invoiceItem.numbers}" với ${betAmount} VNĐ`);
    
    // Với cấu trúc mới, item.numbers chứa tên bộ (ví dụ: "05 06 07")
    const boNumbers = invoiceItem.numbers.split(/[\s,]+/).filter(n => n.length > 0);
    
    boNumbers.forEach(boName => {
      // Đảm bảo format 2 chữ số cho bộ số
      const paddedBoName = boName.padStart(2, '0');
      console.log(`[PRIZE DEBUG] ---> Kiểm tra bộ: ${paddedBoName}`);
      
      if (BO_DATA[paddedBoName] && BO_DATA[paddedBoName].includes(lastTwoDigits)) {
        const winningAmount = betAmount * prizeMultiplier.multiplier * 1000;
        totalWinningAmount += winningAmount;
        winningDetails.push({
          bo: paddedBoName,
          betAmount: betAmount,
          winningAmount: winningAmount
        });
        console.log(`[PRIZE DEBUG] -----> Bộ ${paddedBoName} trúng! Thưởng: ${winningAmount} VNĐ`);
        console.log(`[PRIZE DEBUG] -----> Bộ ${paddedBoName} chứa các số: [${BO_DATA[paddedBoName].join(', ')}]`);
        console.log(`[PRIZE DEBUG] -----> Đề về: ${lastTwoDigits} có trong bộ!`);
      } else {
        console.log(`[PRIZE DEBUG] -----> Bộ ${paddedBoName} không trúng`);
        if (BO_DATA[paddedBoName]) {
          console.log(`[PRIZE DEBUG] -----> Bộ ${paddedBoName} chứa: [${BO_DATA[paddedBoName].join(', ')}], đề về: ${lastTwoDigits}`);
        }
      }
    });
  }
  
  if (totalWinningAmount > 0) {
    return {
      betType: 'bo',
      betTypeLabel: 'Bộ',
      numbers: winningDetails.map(d => d.bo).join(', '),
      betAmount: betAmount,
      winningCount: winningDetails.length,
      multiplier: prizeMultiplier.multiplier,
      prizeAmount: totalWinningAmount,
      detailString: winningDetails.map(d => `Bộ ${d.bo}: ${d.betAmount}n x ${prizeMultiplier.multiplier} = ${d.winningAmount.toLocaleString('vi-VN')} đ`).join(', ')
    };
  }
  
  return null;
};

// Hàm tính thưởng cho 3 số - Logic mới với 5 betType riêng biệt
const calculate3sPrize = async (invoiceItem, lotteryResult, storeId) => {
  const specialPrize = lotteryResult.results?.gdb || lotteryResult.specialPrize;
  const firstPrize = lotteryResult.results?.g1 || lotteryResult.firstPrize;
  const sixthPrizes = lotteryResult.results?.g6 || lotteryResult.sixthPrizes || [];
  
  if (!specialPrize || !firstPrize) {
    return null;
  }
  
  console.log(`[PRIZE DEBUG] --> Giải đặc biệt: ${specialPrize}, Giải 1: ${firstPrize}`);
  console.log(`[PRIZE DEBUG] --> Giải 6: [${sixthPrizes.join(', ')}]`);
  
  const betAmount = parseInt(invoiceItem.amount) || 0;
  if (betAmount === 0) {
    return null;
  }
  
  let betNumbers = [];
  if (invoiceItem.numbers) {
    betNumbers = invoiceItem.numbers.split(/[\s,]+/).filter(n => n.length > 0);
    console.log(`[PRIZE DEBUG] ---> Các số 3 số đã cược: [${betNumbers.join(', ')}] với ${betAmount} VNĐ`);
  }
  
  const totalWinnings = [];
  
  for (const number of betNumbers) {
    const paddedNumber = number.padStart(3, '0');
    const last3SpecialPrize = specialPrize.slice(-3);
    const last3FirstPrize = firstPrize.slice(-3);
    const last2SpecialPrize = specialPrize.slice(-2);
    
    console.log(`[PRIZE DEBUG] -----> Kiểm tra số ${paddedNumber}:`);
    console.log(`[PRIZE DEBUG] -----> 3 số cuối GĐB: ${last3SpecialPrize}, 3 số cuối G1: ${last3FirstPrize}, 2 số cuối GĐB: ${last2SpecialPrize}`);
    
    let winningType = null;
    let betType = null;
    
    // 1. Trùng cả 3 số cuối giải đặc biệt và giải 1 (ưu tiên cao nhất)
    if (paddedNumber === last3SpecialPrize && paddedNumber === last3FirstPrize) {
      winningType = '3 số trùng cả GĐB và G1';
      betType = '3s_gdb_g1';
    }
    // 2. Trùng 3 số cuối giải đặc biệt
    else if (paddedNumber === last3SpecialPrize) {
      winningType = '3 số trùng GĐB';
      betType = '3s_gdb';
    }
    // 3. Trùng 2 số cuối giải đặc biệt và 3 số cuối giải 1
    else if (paddedNumber.slice(-2) === last2SpecialPrize && paddedNumber === last3FirstPrize) {
      winningType = '2 số cuối GĐB và 3 số cuối G1';
      betType = '3s_gdb2_g1';
    }
    // 4. Trùng 3 số cuối giải 1
    else if (paddedNumber === last3FirstPrize) {
      winningType = '3 số trùng G1';
      betType = '3s_g1';
    }
    // 5. Trùng 3 số ở giải 6
    else if (sixthPrizes.some(prize => paddedNumber === prize.slice(-3))) {
      winningType = '3 số trùng G6';
      betType = '3s_g6';
    }
    // 6. Trùng 2 số cuối với giải đặc biệt (logic mới)
    else if (paddedNumber.slice(-2) === last2SpecialPrize) {
      winningType = '3 số có 2 số cuối trùng GĐB';
      betType = '3s_2digits_gdb';
    }
    
    if (winningType && betType) {
      // Tìm hệ số thưởng theo betType riêng biệt
      const prizeMultiplier = await getMultiplierByStore(storeId, betType);
      
      if (prizeMultiplier) {
        const winningAmount = betAmount * prizeMultiplier.multiplier * 1000;
        totalWinnings.push({
          number: paddedNumber,
          type: winningType,
          betAmount: betAmount,
          multiplier: prizeMultiplier.multiplier,
          winningAmount: winningAmount,
          betType: betType
        });
        console.log(`[PRIZE DEBUG] -----> Số ${paddedNumber} ${winningType}! Hệ số: ${prizeMultiplier.multiplier}, Thưởng: ${winningAmount} VNĐ`);
      } else {
        console.log(`[PRIZE DEBUG] -----> Không tìm thấy hệ số thưởng cho ${betType}`);
      }
    } else {
      console.log(`[PRIZE DEBUG] -----> Số ${paddedNumber} không trúng`);
    }
  }
  
  if (totalWinnings.length > 0) {
    // Trả về array các winning items riêng biệt cho mỗi số trúng
    return totalWinnings.map(w => ({
      betType: w.betType,
      betTypeLabel: w.type,
      numbers: w.number,
      betAmount: betAmount,
      winningCount: 1,
      multiplier: w.multiplier,
      prizeAmount: w.winningAmount,
              detailString: `${w.number} (${w.type}): ${betAmount}n x ${w.multiplier} = ${w.winningAmount.toLocaleString('vi-VN')} đ`
    }));
  }
  
  return null;
};

// Hàm tính thưởng cho một hóa đơn
const calculateInvoicePrize = async (invoice, lotteryDate, inputDate) => {
  try {
    // Tìm kết quả xổ số theo turnNum chính xác
    // Chuyển đổi inputDate (YYYY-MM-DD) thành turnNum (DD/MM/YYYY)
    const [year, month, day] = inputDate.split('-');
    const turnNum = `${day}/${month}/${year}`;
    
    console.log(`[PRIZE DEBUG] Tìm kết quả xổ số cho ngày: ${inputDate}`);
    console.log(`[PRIZE DEBUG] TurnNum: ${turnNum}`);
    
    const lotteryResult = await LotteryResult.findOne({
      turnNum: turnNum
      // Loại bỏ storeId filter - tất cả store sử dụng chung kết quả
    });
    
    if (!lotteryResult) {
      return null; // Không có kết quả xổ số
    }
    
    const winningItems = [];
    
    console.log(`[PRIZE DEBUG] === Bắt đầu xử lý hóa đơn: ${invoice.invoiceId} ===`);

    // Kiểm tra từng item trong hóa đơn
    for (const item of invoice.items) {
      let winningItem = null;
      console.log(`[PRIZE DEBUG] -> Đang kiểm tra item: loại cược ${item.betType}`);
      
      switch (item.betType) {
        case 'loto':
          winningItem = await calculateLotoPrize(item, lotteryResult, invoice.storeId);
          break;
        case '2s':
          winningItem = await calculate2sPrize(item, lotteryResult, invoice.storeId);
          break;
        case '3s':
          winningItem = await calculate3sPrize(item, lotteryResult, invoice.storeId);
          break;
        case 'tong':
          winningItem = await calculateTongPrize(item, lotteryResult, invoice.storeId);
          break;
        case 'dau':
          winningItem = await calculateDauPrize(item, lotteryResult, invoice.storeId);
          break;
        case 'dit':
          winningItem = await calculateDitPrize(item, lotteryResult, invoice.storeId);
          break;
        case 'kep':
          winningItem = await calculateKepPrize(item, lotteryResult, invoice.storeId);
          break;
        case 'bo':
          winningItem = await calculateBoPrize(item, lotteryResult, invoice.storeId);
          break;
        case 'xien':
        case 'xien2':
        case 'xien3':
        case 'xien4':
          winningItem = await calculateXienPrize(item, lotteryResult, invoice.storeId);
          break;
        case 'xienquay':
        case 'xienquay3':
        case 'xienquay4':
          winningItem = await calculateXienQuayPrize(item, lotteryResult, invoice.storeId);
          break;
        // TODO: Thêm logic cho các loại cược khác
      }
      
      if (winningItem) {
        // Handle array return from calculate3sPrize
        if (Array.isArray(winningItem)) {
          winningItems.push(...winningItem);
        } else {
        winningItems.push(winningItem);
        }
      }
    }
    
    if (winningItems.length > 0) {
      const totalPrizeAmount = winningItems.reduce((sum, item) => sum + item.prizeAmount, 0);
      
      // Tạo lotteryDate đúng timezone Việt Nam
      // Sử dụng inputDate (YYYY-MM-DD) để tạo lotteryDate chính xác
      const vietnamLotteryDate = new Date(inputDate + 'T00:00:00+07:00');
      
      return {
        invoiceId: `WIN_${invoice.invoiceId}`,
        originalInvoiceId: invoice.invoiceId,
        storeId: invoice.storeId,
        employeeId: invoice.employeeId,
        adminId: invoice.adminId,
        customerName: invoice.customerName,
        lotteryDate: vietnamLotteryDate, // Sử dụng timezone Việt Nam
        date: inputDate, // Sử dụng ngày xổ số thay vì printedAt
        winningItems: winningItems,
        totalPrizeAmount: totalPrizeAmount
      };
    }
    
    return null;
  } catch (error) {
    console.error('Lỗi tính thưởng hóa đơn:', error);
    throw error;
  }
};

// API: Tính thưởng cho tất cả hóa đơn theo ngày
const calculatePrizesForDate = async (req, res) => {
  try {
    const { date } = req.body;
    const user = req.user;
    
    console.log("🔥 [FRONTEND REQUEST] calculatePrizesForDate:");
    console.log(`  - Date: ${date}`);
    console.log(`  - User: ${user ? `${user.username} (${user.role}, store: ${user.storeId})` : "No user"}`);
    console.log(`  - Request body:`, req.body);
    
    if (!date) {
      return res.status(400).json({ message: 'Vui lòng cung cấp ngày cần tính thưởng' });
    }
    
    // Sử dụng timezone Việt Nam trực tiếp để tạo range thời gian
    const startOfDay = new Date(date + 'T00:00:00+07:00');
    const endOfDay = new Date(date + 'T23:59:59.999+07:00');
    
    // Lấy tất cả hóa đơn trong ngày của cửa hàng dựa trên printedAt
    const filter = {
      printedAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    };
    
    // Nếu có user (authenticated), lọc theo storeId
    if (user && user.storeId) {
      filter.storeId = user.storeId;
    }
    
    console.log(`🔍 [FILTER] Query filter:`, JSON.stringify(filter, null, 2));
    
    const invoices = await Invoice.find(filter);
    
    console.log(`📋 [INVOICES] Found ${invoices.length} invoices:`);
    invoices.forEach((inv, index) => {
      const hasXien = inv.items.some(item => item.betType === 'xien');
      console.log(`  ${index + 1}. ${inv.invoiceId} ${hasXien ? "🎯 (có xiên)" : ""} - Store: ${inv.storeId}`);
    });
    
    const winningInvoices = [];
    
    for (const invoice of invoices) {
      const winningData = await calculateInvoicePrize(invoice, startOfDay, date);
      if (winningData) {
        // Kiểm tra xem đã tồn tại chưa
        const existingWinning = await WinningInvoice.findOne({ 
          originalInvoiceId: invoice.invoiceId 
        });
        
        if (!existingWinning) {
          const winningInvoice = new WinningInvoice(winningData);
          await winningInvoice.save();
          winningInvoices.push(winningInvoice);
        } else {
          existingWinning.winningItems = winningData.winningItems;
          existingWinning.totalPrizeAmount = winningData.totalPrizeAmount;
          existingWinning.lotteryDate = winningData.lotteryDate;
          await existingWinning.save();
          winningInvoices.push(existingWinning);
        }
      }
    }
    
    console.log(`🎉 [RESULT] Final result:`);
    console.log(`  - Total winning invoices: ${winningInvoices.length}`);
    winningInvoices.forEach((inv, index) => {
      const hasXien = inv.winningItems && inv.winningItems.some(item => 
        item.betType && item.betType.startsWith('xien')
      );
      console.log(`  ${index + 1}. ${inv.originalInvoiceId} ${hasXien ? "🎯 (xiên)" : ""} - ${inv.totalPrizeAmount} VNĐ`);
    });
    
    res.json({
      message: `Đã tính thưởng cho ${winningInvoices.length} hóa đơn`,
      winningInvoices: winningInvoices
    });
    
  } catch (error) {
    console.error('Lỗi tính thưởng:', error);
    res.status(500).json({ message: 'Lỗi server khi tính thưởng', error: error.message });
  }
};

// API: Lấy danh sách hóa đơn trúng thưởng
const getWinningInvoices = async (req, res) => {
  try {
    const user = req.user;
    const { date, isPaid } = req.query;
    
    let filter = { storeId: user.storeId };
    
    if (date) {
      const startOfDay = new Date(date + 'T00:00:00+07:00');
      const endOfDay = new Date(date + 'T23:59:59.999+07:00');
      filter.lotteryDate = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }
    
    // Lọc theo trạng thái trả thưởng
    if (isPaid !== undefined) {
      filter.isPaid = isPaid === 'true';
    }
    
    const winningInvoices = await WinningInvoice.find(filter)
      .populate('employeeId', 'username')
      .populate('paidBy', 'username')
      .sort({ createdAt: -1 });
    
    res.json(winningInvoices);
    
  } catch (error) {
    console.error('Lỗi lấy danh sách thưởng:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// API: Toggle trạng thái trả thưởng
const togglePaidStatus = async (req, res) => {
  try {
    const user = req.user;
    const { invoiceId } = req.params;
    
    const winningInvoice = await WinningInvoice.findOne({ 
      _id: invoiceId,
      storeId: user.storeId 
    });
    
    if (!winningInvoice) {
      return res.status(404).json({ message: 'Không tìm thấy hóa đơn trúng thưởng' });
    }
    
    // Toggle trạng thái
    winningInvoice.isPaid = !winningInvoice.isPaid;
    
    if (winningInvoice.isPaid) {
      winningInvoice.paidAt = new Date();
      winningInvoice.paidBy = user._id;
    } else {
      winningInvoice.paidAt = null;
      winningInvoice.paidBy = null;
    }
    
    await winningInvoice.save();
    
    const status = winningInvoice.isPaid ? 'đã trả' : 'chưa trả';
    res.json({ 
      message: `Đã cập nhật trạng thái ${status} thưởng`,
      winningInvoice 
    });
    
  } catch (error) {
    console.error('Lỗi toggle trạng thái:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// API: Lấy/cập nhật hệ số thưởng - theo storeId  
const getPrizeMultipliers = async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.storeId) {
      return res.status(400).json({ message: 'User không có storeId' });
    }
    
    const multipliers = await PrizeMultiplier.find({ 
      storeId: user.storeId, 
      isActive: true 
    }).sort({ betType: 1, subType: 1 });
    
    res.json(multipliers);
  } catch (error) {
    console.error('Lỗi lấy hệ số thưởng:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

const updatePrizeMultiplier = async (req, res) => {
  try {
    const { betType, subType, multiplier, description } = req.body;
    const user = req.user;
    
    if (!betType || multiplier === undefined || multiplier === null) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }
    
    if (!user.storeId) {
      return res.status(400).json({ message: 'User không có storeId' });
    }
    
    const storeId = user.storeId;
    
    const updatedMultiplier = await PrizeMultiplier.findOneAndUpdate(
      { storeId, betType, subType: subType || null },
      { 
        storeId,
        betType,
        subType: subType || null,
        multiplier, 
        description: description || `Hệ số thưởng ${betType}${subType ? ` (${subType})` : ''}`,
        updatedBy: user._id 
      },
      { 
        new: true, 
        upsert: true 
      }
    );
    
    res.json(updatedMultiplier);
    
  } catch (error) {
    console.error('Lỗi cập nhật hệ số thưởng:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Hàm khởi tạo dữ liệu mặc định cho hệ số thưởng - Riêng biệt cho từng store
const initializeDefaultMultipliers = async () => {
  try {
    const Store = require('../models/Store');
    
    // Lấy tất cả stores
    const stores = await Store.find();
    
    if (stores.length === 0) {
      console.log('⏳ Chưa có store nào, bỏ qua khởi tạo hệ số thưởng');
      return;
    }
    
    const defaultMultipliers = [
      { betType: 'loto', subType: null, multiplier: 80, description: 'Hệ số thưởng lô tô', isActive: true },
      { betType: '2s', subType: null, multiplier: 85, description: 'Hệ số thưởng 2 số (đề)', isActive: true },
      
      // 5 betType riêng biệt cho 3 số
      { betType: '3s_gdb', subType: null, multiplier: 420, description: '3 số trùng giải đặc biệt', isActive: true },
      { betType: '3s_gdb_g1', subType: null, multiplier: 440, description: '3 số trùng cả giải đặc biệt và giải 1', isActive: true },
      { betType: '3s_gdb2_g1', subType: null, multiplier: 25, description: '2 số cuối GĐB và 3 số cuối G1', isActive: true },
      { betType: '3s_g1', subType: null, multiplier: 20, description: '3 số trùng giải 1', isActive: true },
      { betType: '3s_g6', subType: null, multiplier: 5, description: '3 số trùng giải 6', isActive: true },
      { betType: '3s_2digits_gdb', subType: null, multiplier: 5, description: '3 số có 2 số cuối trùng GĐB (x5)', isActive: true },
      
      { betType: 'tong', subType: null, multiplier: 85, description: 'Hệ số thưởng tổng', isActive: true },
      { betType: 'kep', subType: null, multiplier: 85, description: 'Hệ số thưởng kép', isActive: true },
      { betType: 'dau', subType: null, multiplier: 85, description: 'Hệ số thưởng đầu', isActive: true },
      { betType: 'dit', subType: null, multiplier: 85, description: 'Hệ số thưởng đít', isActive: true },
      { betType: 'bo', subType: null, multiplier: 85, description: 'Hệ số thưởng bộ', isActive: true },
      { betType: 'xien', subType: null, multiplier: 23, description: 'Hệ số thưởng xiên', isActive: false },
      { betType: 'xienquay', subType: null, multiplier: 23, description: 'Hệ số thưởng xiên quay', isActive: false },
      
      // 9 loại xiên riêng biệt
      { betType: 'xien2_full', subType: null, multiplier: 12, description: 'Xiên 2 - Trúng cả 2 số', isActive: true },
      { betType: 'xien2_1hit', subType: null, multiplier: 1, description: 'Xiên 2 - Trúng 1 số (≥2 nháy)', isActive: true },
      { betType: 'xien3_full', subType: null, multiplier: 45, description: 'Xiên 3 - Trúng cả 3 số', isActive: true },
      { betType: 'xien3_2hit_both', subType: null, multiplier: 10, description: 'Xiên 3 - Trúng 2 số (cả 2 ≥2 nháy)', isActive: true },
      { betType: 'xien3_2hit_one', subType: null, multiplier: 2, description: 'Xiên 3 - Trúng 2 số (1 số ≥2 nháy)', isActive: true },
      { betType: 'xien4_full', subType: null, multiplier: 110, description: 'Xiên 4 - Trúng cả 4 số', isActive: true },
      { betType: 'xien4_3hit_all', subType: null, multiplier: 30, description: 'Xiên 4 - Trúng 3 số (cả 3 ≥2 nháy)', isActive: true },
      { betType: 'xien4_3hit_two', subType: null, multiplier: 15, description: 'Xiên 4 - Trúng 3 số (2 số ≥2 nháy)', isActive: true },
      { betType: 'xien4_3hit_one', subType: null, multiplier: 5, description: 'Xiên 4 - Trúng 3 số (1 số ≥2 nháy)', isActive: true },
      
      // 5 loại xiên quay riêng biệt
      { betType: 'xienquay4_full', subType: null, multiplier: 362, description: 'Xiên quay 4 - Trúng cả 4 con', isActive: true },
      { betType: 'xienquay4_3con', subType: null, multiplier: 81, description: 'Xiên quay 4 - Trúng 3 con', isActive: true },
      { betType: 'xienquay4_2con', subType: null, multiplier: 12, description: 'Xiên quay 4 - Trúng 2 con', isActive: true },
      { betType: 'xienquay3_full', subType: null, multiplier: 81, description: 'Xiên quay 3 - Trúng cả 3 con', isActive: true },
      { betType: 'xienquay3_2con', subType: null, multiplier: 12, description: 'Xiên quay 3 - Trúng 2 con', isActive: true }
    ];
    
    let storesInitialized = 0;
    
    for (const store of stores) {
      // Kiểm tra xem store này đã có hệ số thưởng chưa
      const existingCount = await PrizeMultiplier.countDocuments({ storeId: store._id });
      
      if (existingCount === 0) {
        // Chưa có hệ số thưởng cho store này, tạo mới tất cả
        for (const multiplierTemplate of defaultMultipliers) {
          const multiplier = {
            ...multiplierTemplate,
            storeId: store._id
          };
          
          await PrizeMultiplier.create(multiplier);
        }
        
        storesInitialized++;
        console.log(`✅ Khởi tạo hệ số thưởng cho store: ${store.name}`);
      } else {
        // Store đã có hệ số thưởng, kiểm tra xem có thiếu loại nào không
        let missingMultipliers = 0;
        
        for (const multiplierTemplate of defaultMultipliers) {
          const existing = await PrizeMultiplier.findOne({
            storeId: store._id,
            betType: multiplierTemplate.betType,
            subType: multiplierTemplate.subType
          });
          
          if (!existing) {
            // Thiếu hệ số này, tạo mới
            const multiplier = {
              ...multiplierTemplate,
              storeId: store._id
            };
            
            await PrizeMultiplier.create(multiplier);
            missingMultipliers++;
          }
        }
        
        if (missingMultipliers > 0) {
          console.log(`✅ Store ${store.name} đã có ${existingCount} hệ số thưởng, thêm ${missingMultipliers} hệ số mới`);
          storesInitialized++;
        } else {
          console.log(`⏭️ Store ${store.name} đã có ${existingCount} hệ số thưởng, bỏ qua`);
        }
      }
    }
    
    if (storesInitialized > 0) {
      console.log(`🎉 Đã khởi tạo hệ số thưởng cho ${storesInitialized} store(s)`);
    } else {
      console.log('✅ Tất cả stores đã có hệ số thưởng');
    }
    
  } catch (error) {
    console.error('Lỗi khởi tạo hệ số thưởng:', error);
  }
};

module.exports = {
  calculatePrizesForDate,
  getWinningInvoices,
  togglePaidStatus,
  getPrizeMultipliers,
  updatePrizeMultiplier,
  initializeDefaultMultipliers,
  calculate3sPrize,
  calculateXienQuayPrize,
  calculateXienPrize
};