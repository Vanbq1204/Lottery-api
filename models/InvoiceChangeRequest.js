const mongoose = require('mongoose');

const invoiceChangeRequestSchema = new mongoose.Schema({
  invoiceId: { type: String, required: true, index: true },
  invoiceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestType: { type: String, enum: ['edit', 'delete'], required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reason: { type: String, default: '' },
  decisionNote: { type: String, default: '' },
  requestedAt: { type: Date, default: Date.now },
  decidedAt: { type: Date }
});

invoiceChangeRequestSchema.index({ adminId: 1, status: 1, requestedAt: -1 });

module.exports = mongoose.model('InvoiceChangeRequest', invoiceChangeRequestSchema);