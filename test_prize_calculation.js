require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
const LotteryResult = require('./models/lotteryResult');
const WinningInvoice = require('./models/WinningInvoice');

// Kết nối database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
console.log('🔗 Connecting to:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    testPrizeCalculation();
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
  });

const testPrizeCalculation = async () => {
  try {
    console.log('🧪 Test tính thưởng cho store Lương Định Của...\n');
    
    const testDate = '2025-08-20';
    const storeId = '68a290fbed5d562c1815fb54'; // Store Lương Định Của
    
    // 1. Lấy kết quả xổ số
    const startOfDay = new Date(testDate + 'T00:00:00+07:00');
    const endOfDay = new Date(testDate + 'T23:59:59.999+07:00');
    
    const lotteryResult = await LotteryResult.findOne({
      storeId: storeId,
      openTime: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    });
    
    if (!lotteryResult) {
      console.log('❌ Không tìm thấy kết quả xổ số cho store này');
      return;
    }
    
    console.log('✅ Tìm thấy kết quả xổ số:');
    console.log(`   TurnNum: ${lotteryResult.turnNum}`);
    console.log(`   OpenTime: ${lotteryResult.openTime}`);
    console.log(`   Results:`, lotteryResult.results);
    
    // 2. Lấy hóa đơn
    const invoices = await Invoice.find({
      storeId: storeId,
      printedAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });
    
    console.log(`\n✅ Tìm thấy ${invoices.length} hóa đơn:`);
    invoices.forEach((invoice, index) => {
      console.log(`   ${index + 1}. ${invoice.invoiceId} | Items: ${invoice.items.length}`);
      invoice.items.forEach((item, itemIndex) => {
        console.log(`      Item ${itemIndex + 1}: ${item.betType} - ${item.numbers} - ${item.points || item.amount}`);
      });
    });
    
    // 3. Test tính thưởng cho từng hóa đơn
    console.log('\n🎯 Test tính thưởng:');
    
    for (const invoice of invoices) {
      console.log(`\n   Hóa đơn: ${invoice.invoiceId}`);
      
      for (const item of invoice.items) {
        console.log(`     Item: ${item.betType} - ${item.numbers} - ${item.points || item.amount}`);
        
        // Test logic tính thưởng đơn giản
        if (item.betType === 'loto') {
          const numbers = item.numbers.split(/[\s,]+/).filter(n => n.trim());
          const points = parseFloat(item.points) || 0;
          
          console.log(`       Numbers: [${numbers.join(', ')}]`);
          console.log(`       Points: ${points}`);
          
          // Kiểm tra trúng giải đặc biệt
          const gdb = lotteryResult.results.gdb;
          if (gdb && numbers.includes(gdb)) {
            console.log(`       🎉 TRÚNG GIẢI ĐẶC BIỆT: ${gdb}`);
          }
          
          // Kiểm tra trúng các giải khác
          const allPrizes = [
            lotteryResult.results.g1,
            ...lotteryResult.results.g2,
            ...lotteryResult.results.g3,
            ...lotteryResult.results.g4,
            ...lotteryResult.results.g5,
            ...lotteryResult.results.g6,
            ...lotteryResult.results.g7
          ].filter(prize => prize);
          
          const winningNumbers = numbers.filter(num => allPrizes.includes(num));
          if (winningNumbers.length > 0) {
            console.log(`       🎯 TRÚNG: [${winningNumbers.join(', ')}]`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    mongoose.connection.close();
  }
}; 