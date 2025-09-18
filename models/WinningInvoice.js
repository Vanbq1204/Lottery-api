const mongoose = require('mongoose');

const winningItemSchema = new mongoose.Schema({
  betType: {
    type: String,
    required: true,
    enum: [
      'loto', '2s', '3s', '4s', 'tong', 'kep', 'dau', 'dit', 'bo', 'xien', 'xienquay',
      // Xiên quay
      'xienquay2', 'xienquay3', 'xienquay4', 'xienquay3_full', 'xienquay3_2con', 'xienquay4_full', 'xienquay4_3con', 'xienquay4_2con',
      // Xiên
      'xien2', 'xien2_full', 'xien2_1hit', 'xien3', 'xien3_full', 'xien3_2hit_both', 'xien3_2hit_one', 
      'xien4', 'xien4_full', 'xien4_3hit_all', 'xien4_3hit_two', 'xien4_3hit_one',
      // 3 số cụ thể
      '3s_gdb_g1', '3s_gdb', '3s_gdb2_g1', '3s_g1', '3s_g6', '3s_2digits_gdb',
      // 4 số cụ thể
      '4s_full', '4s_3digits', '4s_2digits'
    ]
  },
  numbers: {
    type: String,
    required: true
  },
  betAmount: {
    type: Number,
    required: true
  },
  winningCount: {
    type: Number,
    required: true,
    default: 1
  },
  multiplier: {
    type: Number,
    required: true
  },
  prizeAmount: {
    type: Number,
    required: true
  },
  detailString: {
    type: String
  },
  betTypeLabel: {
    type: String
  }
});

const winningInvoiceSchema = new mongoose.Schema({
  invoiceId: {
    type: String,
    required: true,
    unique: true
  },
  originalInvoiceId: {
    type: String,
    required: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  lotteryDate: {
    type: Date,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  winningItems: [winningItemSchema],
  totalPrizeAmount: {
    type: Number,
    required: true
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  paidAt: {
    type: Date
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('WinningInvoice', winningInvoiceSchema);