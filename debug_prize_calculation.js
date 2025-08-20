require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('./models/Invoice');
const LotteryResult = require('./models/lotteryResult');
const WinningInvoice = require('./models/WinningInvoice');
const Store = require('./models/Store');

// Kết nối database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
console.log('🔗 Connecting to:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    debugPrizeCalculation();
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
  });

const debugPrizeCalculation = async () => {
  try {
    console.log('🔍 Bắt đầu debug tính thưởng...\n');
    
    // Test với ngày hôm nay
    const testDate = '2025-08-20';
    console.log(`📅 Test date: ${testDate}`);
    
    // 1. Kiểm tra kết quả xổ số
    console.log('\n1️⃣ Kiểm tra kết quả xổ số:');
    const startOfDay = new Date(testDate + 'T00:00:00+07:00');
    const endOfDay = new Date(testDate + 'T23:59:59.999+07:00');
    
    console.log(`   Start of day: ${startOfDay.toISOString()}`);
    console.log(`   End of day: ${endOfDay.toISOString()}`);
    
    const lotteryResults = await LotteryResult.find({
      openTime: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    });
    
    console.log(`   Tìm thấy ${lotteryResults.length} kết quả xổ số:`);
    lotteryResults.forEach((result, index) => {
      console.log(`   ${index + 1}. StoreId: ${result.storeId} | TurnNum: ${result.turnNum} | OpenTime: ${result.openTime}`);
    });
    
    // 2. Kiểm tra hóa đơn
    console.log('\n2️⃣ Kiểm tra hóa đơn:');
    const invoices = await Invoice.find({
      printedAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });
    
    console.log(`   Tìm thấy ${invoices.length} hóa đơn:`);
    invoices.forEach((invoice, index) => {
      console.log(`   ${index + 1}. ${invoice.invoiceId} | StoreId: ${invoice.storeId} | PrintedAt: ${invoice.printedAt} | Items: ${invoice.items.length}`);
    });
    
    // 3. Kiểm tra hóa đơn thưởng đã có
    console.log('\n3️⃣ Kiểm tra hóa đơn thưởng đã có:');
    const winningInvoices = await WinningInvoice.find({
      lotteryDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });
    
    console.log(`   Tìm thấy ${winningInvoices.length} hóa đơn thưởng:`);
    winningInvoices.forEach((winning, index) => {
      console.log(`   ${index + 1}. ${winning.originalInvoiceId} | LotteryDate: ${winning.lotteryDate} | Prize: ${winning.totalPrizeAmount}`);
    });
    
    // 4. Test với từng store
    console.log('\n4️⃣ Test theo từng store:');
    const stores = await Store.find();
    
    for (const store of stores) {
      console.log(`\n   Store: ${store.name} (${store._id})`);
      
      // Kết quả xổ số của store
      const storeLottery = await LotteryResult.find({
        storeId: store._id,
        openTime: {
          $gte: startOfDay,
          $lt: endOfDay
        }
      });
      console.log(`   - Kết quả xổ số: ${storeLottery.length}`);
      
      // Hóa đơn của store
      const storeInvoices = await Invoice.find({
        storeId: store._id,
        printedAt: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });
      console.log(`   - Hóa đơn: ${storeInvoices.length}`);
      
      // Hóa đơn thưởng của store
      const storeWinning = await WinningInvoice.find({
        storeId: store._id,
        lotteryDate: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });
      console.log(`   - Hóa đơn thưởng: ${storeWinning.length}`);
    }
    
    // 5. Kiểm tra timezone
    console.log('\n5️⃣ Kiểm tra timezone:');
    console.log(`   Current time: ${new Date().toISOString()}`);
    console.log(`   Vietnam time: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
    
    // 6. Test với ngày khác
    console.log('\n6️⃣ Test với ngày khác (19/8):');
    const testDate2 = '2025-08-19';
    const startOfDay2 = new Date(testDate2 + 'T00:00:00+07:00');
    const endOfDay2 = new Date(testDate2 + 'T23:59:59.999+07:00');
    
    const invoices2 = await Invoice.find({
      printedAt: {
        $gte: startOfDay2,
        $lte: endOfDay2
      }
    });
    console.log(`   Hóa đơn ngày 19/8: ${invoices2.length}`);
    
    const lottery2 = await LotteryResult.find({
      openTime: {
        $gte: startOfDay2,
        $lt: endOfDay2
      }
    });
    console.log(`   Kết quả xổ số ngày 19/8: ${lottery2.length}`);
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    mongoose.connection.close();
  }
}; 