const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/loto_web', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function checkXienNhayData() {
  try {
    console.log('Checking for invoices with isXienNhay = true...');
    
    // Find all invoices with xiên nháy
    const invoicesWithXienNhay = await Invoice.find({
      'items.isXienNhay': true
    }).limit(10);
    
    console.log(`Found ${invoicesWithXienNhay.length} invoices with xiên nháy`);
    
    invoicesWithXienNhay.forEach((invoice, index) => {
      console.log(`\nInvoice ${index + 1}: ${invoice.invoiceId}`);
      invoice.items.forEach((item, itemIndex) => {
        if (item.isXienNhay) {
          console.log(`  Item ${itemIndex + 1}: ${item.betType} - ${item.numbers} - ${item.amount}n - isXienNhay: ${item.isXienNhay}`);
        }
      });
    });
    
    // Also check recent invoices to see structure
    console.log('\n--- Recent invoices structure ---');
    const recentInvoices = await Invoice.find({}).sort({ printedAt: -1 }).limit(5);
    
    recentInvoices.forEach((invoice, index) => {
      console.log(`\nRecent Invoice ${index + 1}: ${invoice.invoiceId}`);
      invoice.items.forEach((item, itemIndex) => {
        if (item.betType === 'xien') {
          console.log(`  Xien Item ${itemIndex + 1}: ${item.numbers} - ${item.amount}n - isXienNhay: ${item.isXienNhay || 'undefined'}`);
        }
      });
    });
    
  } catch (error) {
    console.error('Error checking data:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkXienNhayData();