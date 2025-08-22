const mongoose = require('mongoose');
const LotteryResult = require('../models/lotteryResult');

// Kết nối database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery_db');
    console.log('✅ Kết nối database thành công');
  } catch (error) {
    console.error('❌ Lỗi kết nối database:', error);
    process.exit(1);
  }
};

// Migration script
const migrateLotteryResults = async () => {
  try {
    console.log('🔄 Bắt đầu migration lottery results...');
    
    // Lấy tất cả lottery results hiện có
    const allResults = await LotteryResult.find({});
    console.log(`📊 Tìm thấy ${allResults.length} kết quả xổ số`);
    
    // Nhóm theo turnNum để tìm duplicates
    const groupedByTurnNum = {};
    allResults.forEach(result => {
      if (!groupedByTurnNum[result.turnNum]) {
        groupedByTurnNum[result.turnNum] = [];
      }
      groupedByTurnNum[result.turnNum].push(result);
    });
    
    console.log(`📊 Có ${Object.keys(groupedByTurnNum).length} turnNum khác nhau`);
    
    // Xử lý từng turnNum
    for (const [turnNum, results] of Object.entries(groupedByTurnNum)) {
      if (results.length === 1) {
        // Chỉ có 1 kết quả cho turnNum này, chỉ cần loại bỏ storeId
        const result = results[0];
        console.log(`✅ Cập nhật turnNum ${turnNum} (1 kết quả)`);
        
        // Loại bỏ storeId và adminId
        result.storeId = undefined;
        result.adminId = undefined;
        await result.save();
        
      } else {
        // Có nhiều kết quả cho cùng turnNum, giữ lại kết quả mới nhất
        console.log(`⚠️ TurnNum ${turnNum} có ${results.length} kết quả, giữ lại kết quả mới nhất`);
        
        // Sắp xếp theo thời gian tạo, giữ lại kết quả mới nhất
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const latestResult = results[0];
        
        // Loại bỏ storeId và adminId từ kết quả mới nhất
        latestResult.storeId = undefined;
        latestResult.adminId = undefined;
        await latestResult.save();
        
        // Xóa các kết quả cũ
        const oldResults = results.slice(1);
        for (const oldResult of oldResults) {
          await LotteryResult.findByIdAndDelete(oldResult._id);
          console.log(`🗑️ Xóa kết quả cũ: ${oldResult._id}`);
        }
      }
    }
    
    console.log('✅ Migration hoàn thành!');
    
    // Kiểm tra kết quả
    const finalResults = await LotteryResult.find({});
    console.log(`📊 Sau migration: ${finalResults.length} kết quả xổ số`);
    
    // Kiểm tra xem còn storeId nào không
    const resultsWithStoreId = await LotteryResult.find({ storeId: { $exists: true } });
    if (resultsWithStoreId.length > 0) {
      console.log(`⚠️ Vẫn còn ${resultsWithStoreId.length} kết quả có storeId`);
    } else {
      console.log('✅ Tất cả kết quả đã được loại bỏ storeId');
    }
    
  } catch (error) {
    console.error('❌ Lỗi migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Đã ngắt kết nối database');
  }
};

// Chạy migration
if (require.main === module) {
  connectDB().then(() => {
    migrateLotteryResults();
  });
}

module.exports = { migrateLotteryResults }; 