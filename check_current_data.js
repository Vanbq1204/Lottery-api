require('dotenv').config();
const mongoose = require('mongoose');
const LotteryResult = require('./models/lotteryResult');
const Invoice = require('./models/Invoice');
const WinningInvoice = require('./models/WinningInvoice');

// Kết nối database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
console.log('🔗 Connecting to:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    checkCurrentData();
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
  });

const checkCurrentData = async () => {
  try {
    console.log('🔍 Kiểm tra dữ liệu hiện tại...\n');
    
    const storeId = '68a37ba55bd16bbd22b4a036';
    
    // 1. Kiểm tra kết quả xổ số
    console.log('1️⃣ Kết quả xổ số hiện tại:');
    const lotteryResults = await LotteryResult.find({ storeId: storeId });
    console.log(`   Tổng cộng: ${lotteryResults.length} kết quả:`);
    lotteryResults.forEach((result, index) => {
      console.log(`   ${index + 1}. TurnNum: ${result.turnNum} | OpenTime: ${result.openTime} | OpenNum: ${result.openNum}`);
    });
    
    // 2. Kiểm tra hóa đơn theo ngày
    console.log('\n2️⃣ Hóa đơn theo ngày:');
    const testDates = ['2025-08-19', '2025-08-20'];
    
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
    
    // 3. Kiểm tra hóa đơn thưởng
    console.log('\n3️⃣ Hóa đơn thưởng hiện tại:');
    const winningInvoices = await WinningInvoice.find({ storeId: storeId });
    console.log(`   Tổng cộng: ${winningInvoices.length} hóa đơn thưởng:`);
    winningInvoices.forEach((winning, index) => {
      console.log(`   ${index + 1}. ${winning.originalInvoiceId} | LotteryDate: ${winning.lotteryDate} | TotalPrize: ${winning.totalPrizeAmount}`);
    });
    
    // 4. Test logic tìm kết quả xổ số
    console.log('\n4️⃣ Test logic tìm kết quả xổ số:');
    for (const date of testDates) {
      const [year, month, day] = date.split('-');
      const turnNum = `${day}/${month}/${year}`;
      
      const result = await LotteryResult.findOne({
        storeId: storeId,
        turnNum: turnNum
      });
      
      if (result) {
        console.log(`   ✅ Ngày ${date} (turnNum: ${turnNum}): Tìm thấy kết quả xổ số`);
        console.log(`      OpenTime: ${result.openTime}`);
        console.log(`      OpenNum: ${result.openNum}`);
      } else {
        console.log(`   ❌ Ngày ${date} (turnNum: ${turnNum}): Không tìm thấy kết quả xổ số`);
      }
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    mongoose.connection.close();
  }
}; 