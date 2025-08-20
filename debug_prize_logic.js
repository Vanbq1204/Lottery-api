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
    debugPrizeLogic();
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
  });

const debugPrizeLogic = async () => {
  try {
    console.log('🔍 Debug logic tính thưởng chi tiết...\n');
    
    const storeId = '68a37ba55bd16bbd22b4a036';
    const testDate = '2025-08-20';
    
    // 1. Test logic tìm kết quả xổ số
    console.log('1️⃣ Test logic tìm kết quả xổ số:');
    const [year, month, day] = testDate.split('-');
    const turnNum = `${day}/${month}/${year}`;
    
    console.log(`   Input date: ${testDate}`);
    console.log(`   TurnNum: ${turnNum}`);
    
    const lotteryResult = await LotteryResult.findOne({
      storeId: storeId,
      turnNum: turnNum
    });
    
    if (lotteryResult) {
      console.log(`   ✅ Tìm thấy kết quả xổ số:`);
      console.log(`      TurnNum: ${lotteryResult.turnNum}`);
      console.log(`      OpenTime: ${lotteryResult.openTime}`);
      console.log(`      OpenNum: ${lotteryResult.openNum}`);
    } else {
      console.log(`   ❌ Không tìm thấy kết quả xổ số`);
    }
    
    // 2. Test logic tìm hóa đơn
    console.log('\n2️⃣ Test logic tìm hóa đơn:');
    const startOfDay = new Date(testDate + 'T00:00:00+07:00');
    const endOfDay = new Date(testDate + 'T23:59:59.999+07:00');
    
    console.log(`   Date range: ${startOfDay.toISOString()} - ${endOfDay.toISOString()}`);
    
    const invoices = await Invoice.find({
      storeId: storeId,
      printedAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });
    
    console.log(`   Tìm thấy ${invoices.length} hóa đơn:`);
    invoices.forEach((invoice, index) => {
      console.log(`      ${index + 1}. ${invoice.invoiceId} | PrintedAt: ${invoice.printedAt}`);
    });
    
    // 3. Test logic calculateInvoicePrize
    console.log('\n3️⃣ Test logic calculateInvoicePrize:');
    if (invoices.length > 0 && lotteryResult) {
      console.log(`   Có ${invoices.length} hóa đơn và có kết quả xổ số -> Sẽ tính thưởng`);
    } else if (invoices.length > 0 && !lotteryResult) {
      console.log(`   Có ${invoices.length} hóa đơn nhưng KHÔNG có kết quả xổ số -> KHÔNG tính thưởng`);
    } else if (invoices.length === 0) {
      console.log(`   Không có hóa đơn -> KHÔNG tính thưởng`);
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    mongoose.connection.close();
  }
}; 