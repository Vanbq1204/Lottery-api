require('dotenv').config();
const mongoose = require('mongoose');
const LotteryResult = require('./models/lotteryResult');
const WinningInvoice = require('./models/WinningInvoice');

// Kết nối database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
console.log('🔗 Connecting to:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    cleanTestData();
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
  });

const cleanTestData = async () => {
  try {
    console.log('🧹 Dọn dẹp dữ liệu test...\n');
    
    const storeId = '68a37ba55bd16bbd22b4a036';
    
    // 1. Xóa kết quả xổ số test
    console.log('1️⃣ Xóa kết quả xổ số test:');
    const deletedResults = await LotteryResult.deleteMany({
      storeId: storeId,
      turnNum: '19/08/2025'
    });
    console.log(`   Đã xóa ${deletedResults.deletedCount} kết quả xổ số`);
    
    // 2. Xóa hóa đơn thưởng test
    console.log('\n2️⃣ Xóa hóa đơn thưởng test:');
    const deletedWinningInvoices = await WinningInvoice.deleteMany({
      storeId: storeId,
      originalInvoiceId: { $in: ['HDNTLNND7592', 'HDNTLNND3893'] }
    });
    console.log(`   Đã xóa ${deletedWinningInvoices.deletedCount} hóa đơn thưởng`);
    
    // 3. Kiểm tra lại
    console.log('\n3️⃣ Kiểm tra lại dữ liệu:');
    const remainingResults = await LotteryResult.find({ storeId: storeId });
    console.log(`   Còn lại ${remainingResults.length} kết quả xổ số`);
    
    const remainingWinningInvoices = await WinningInvoice.find({ storeId: storeId });
    console.log(`   Còn lại ${remainingWinningInvoices.length} hóa đơn thưởng`);
    
    console.log('\n✅ Dọn dẹp hoàn tất!');
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    mongoose.connection.close();
  }
}; 