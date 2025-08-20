require('dotenv').config();
const mongoose = require('mongoose');
const WinningInvoice = require('./models/WinningInvoice');

// Kết nối database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
console.log('🔗 Connecting to:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    cleanOldWinningInvoices();
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
  });

const cleanOldWinningInvoices = async () => {
  try {
    console.log('🧹 Xóa hóa đơn thưởng cũ...\n');
    
    const storeId = '68a37ba55bd16bbd22b4a036';
    
    // Xóa tất cả hóa đơn thưởng của store này
    const deletedCount = await WinningInvoice.deleteMany({
      storeId: storeId
    });
    
    console.log(`✅ Đã xóa ${deletedCount.deletedCount} hóa đơn thưởng cũ`);
    
    // Kiểm tra lại
    const remainingCount = await WinningInvoice.countDocuments({ storeId: storeId });
    console.log(`📊 Còn lại ${remainingCount} hóa đơn thưởng`);
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    mongoose.connection.close();
  }
}; 