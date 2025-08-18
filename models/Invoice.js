const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  betType: {
    type: String,
    required: true,
    enum: ['loto', '2s', '3s', 'tong', 'kep', 'dau', 'dit', 'bo', 'xien', 'xienquay']
  },
  betTypeLabel: {
    type: String,
    required: true
  },
  numbers: {
    type: String,
    required: true
  },
  displayNumbers: {
    type: String,
    required: true
  },
  points: {
    type: Number,
    default: null // Chỉ dành cho loto
  },
  amount: {
    type: Number,
    default: null // Dành cho các loại cược khác
  },
  totalAmount: {
    type: Number,
    required: true
  }
});

const invoiceSchema = new mongoose.Schema({
  invoiceId: {
    type: String,
    required: true,
    unique: true
  },
  customerName: {
    type: String,
    default: 'Khách lẻ'
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [invoiceItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  customerPaid: {
    type: Number,
    required: true
  },
  changeAmount: {
    type: Number,
    required: true,
    default: 0
  },
  printedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'won'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Index for better query performance
invoiceSchema.index({ storeId: 1, printedAt: -1 });
invoiceSchema.index({ adminId: 1, printedAt: -1 });
invoiceSchema.index({ employeeId: 1, printedAt: -1 });
invoiceSchema.index({ invoiceId: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema); 