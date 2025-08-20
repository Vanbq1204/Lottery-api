require('dotenv').config();
const mongoose = require('mongoose');
const LotteryResult = require('./models/lotteryResult');
const Invoice = require('./models/Invoice');

// Kết nối database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
console.log('🔗 Connecting to:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    debugLotteryData();
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
  });

const debugLotteryData = async () => {
  try {
    console.log('🔍 Debug dữ liệu kết quả xổ số...\n');
    
    const storeId = '68a37ba55bd16bbd22b4a036';
    
    // 1. Kiểm tra tất cả kết quả xổ số
    console.log('1️⃣ Tất cả kết quả xổ số:');
    const allResults = await LotteryResult.find({ storeId: storeId }).sort({ openTime: -1 });
    console.log(`   Tổng cộng: ${allResults.length} kết quả:`);
    allResults.forEach((result, index) => {
      console.log(`   ${index + 1}. TurnNum: ${result.turnNum} | OpenTime: ${result.openTime} | OpenNum: ${result.openNum}`);
    });
    
    // 2. Test tìm theo turnNum
    console.log('\n2️⃣ Test tìm theo turnNum:');
    const testTurnNums = ['19/08/2025', '20/08/2025'];
    
    for (const turnNum of testTurnNums) {
      const result = await LotteryResult.findOne({
        storeId: storeId,
        turnNum: turnNum
      });
      
      if (result) {
        console.log(`   ✅ Tìm thấy kết quả cho ${turnNum}:`);
        console.log(`      OpenTime: ${result.openTime}`);
        console.log(`      OpenNum: ${result.openNum}`);
      } else {
        console.log(`   ❌ Không tìm thấy kết quả cho ${turnNum}`);
      }
    }
    
    // 3. Test tìm theo openTime range
    console.log('\n3️⃣ Test tìm theo openTime range:');
    const testDates = ['2025-08-19', '2025-08-20'];
    
    for (const date of testDates) {
      const startOfDay = new Date(date + 'T00:00:00+07:00');
      const endOfDay = new Date(date + 'T23:59:59.999+07:00');
      
      console.log(`   Ngày ${date}:`);
      console.log(`      Start: ${startOfDay.toISOString()}`);
      console.log(`      End: ${endOfDay.toISOString()}`);
      
      const results = await LotteryResult.find({
        storeId: storeId,
        openTime: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });
      
      console.log(`      Tìm thấy: ${results.length} kết quả`);
      results.forEach((result, index) => {
        console.log(`         ${index + 1}. TurnNum: ${result.turnNum} | OpenTime: ${result.openTime}`);
      });
    }
    
    // 4. Kiểm tra hóa đơn theo ngày
    console.log('\n4️⃣ Kiểm tra hóa đơn theo ngày:');
    for (const date of testDates) {
      const startOfDay = new Date(date + 'T00:00:00+07:00');
      const endOfDay = new Date(date + 'T23:59:59.999+07:00');
      
      const invoices = await Invoice.find({
        storeId: storeId,
        printedAt: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });
      
      console.log(`   Ngày ${date}: ${invoices.length} hóa đơn`);
      invoices.forEach((invoice, index) => {
        console.log(`      ${index + 1}. ${invoice.invoiceId} | PrintedAt: ${invoice.printedAt}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    mongoose.connection.close();
  }
}; 