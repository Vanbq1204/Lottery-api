const mongoose = require('mongoose');

const invoiceHistorySchema = new mongoose.Schema({
  invoiceId: {
    type: String,
    required: true,
    index: true
  },
  originalInvoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
  },
  action: {
    type: String,
    enum: ['edit', 'delete'],
    required: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  changes: {
    type: mongoose.Schema.Types.Mixed, // Lưu trữ thay đổi dưới dạng object
    default: {}
  },
  oldData: {
    type: mongoose.Schema.Types.Mixed, // Dữ liệu cũ
    default: {}
  },
  newData: {
    type: mongoose.Schema.Types.Mixed, // Dữ liệu mới
    default: {}
  },
  reason: {
    type: String,
    default: ''
  },
  actionDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
invoiceHistorySchema.index({ storeId: 1, actionDate: -1 });
invoiceHistorySchema.index({ adminId: 1, actionDate: -1 });
invoiceHistorySchema.index({ employeeId: 1, actionDate: -1 });
invoiceHistorySchema.index({ invoiceId: 1, actionDate: -1 });

module.exports = mongoose.model('InvoiceHistory', invoiceHistorySchema); 