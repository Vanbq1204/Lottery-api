const mongoose = require('mongoose');

const resultsSchema = new mongoose.Schema({
  gdb: { type: String, default: '' },
  g1: { type: String, default: '' },
  g2: [{ type: String }],
  g3: [{ type: String }],
  g4: [{ type: String }],
  g5: [{ type: String }],
  g6: [{ type: String }],
  g7: [{ type: String }]
}, { _id: false });

const lotteryResultHistorySchema = new mongoose.Schema({
  turnNum: { type: String, required: true, index: true },
  action: { type: String, enum: ['create', 'update'], required: true },
  changedAt: { type: Date, default: Date.now, index: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changedByName: { type: String },
  changedByUsername: { type: String },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  storeName: { type: String },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminName: { type: String },
  beforeResults: { type: resultsSchema },
  afterResults: { type: resultsSchema }
}, { timestamps: true });

lotteryResultHistorySchema.index({ turnNum: 1, changedAt: -1 });

module.exports = mongoose.model('LotteryResultHistory', lotteryResultHistorySchema);