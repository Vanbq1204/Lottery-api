const mongoose = require('mongoose');

const lotteryResultSchema = new mongoose.Schema({
  turnNum: {
    type: String,
    required: true,
    index: true
  },
  openTime: {
    type: Date,
    required: true,
    index: true
  },
  openNum: {
    type: String,
    required: true
  },
  results: {
    gdb: { type: String, default: '' }, // Giải đặc biệt
    g1: { type: String, default: '' },  // Giải nhất
    g2: [{ type: String }],             // Giải nhì
    g3: [{ type: String }],             // Giải ba
    g4: [{ type: String }],             // Giải tư
    g5: [{ type: String }],             // Giải năm
    g6: [{ type: String }],             // Giải sáu
    g7: [{ type: String }]              // Giải bảy
  },
  createdBy: {
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
  }
}, {
  timestamps: true
});

// Index for efficient querying
lotteryResultSchema.index({ turnNum: -1 });
lotteryResultSchema.index({ openTime: -1 });
lotteryResultSchema.index({ storeId: 1, openTime: -1 });
lotteryResultSchema.index({ adminId: 1, openTime: -1 });

// Unique combination: turnNum + storeId (each store can have same turnNum)
lotteryResultSchema.index({ turnNum: 1, storeId: 1 }, { unique: true });

const LotteryResult = mongoose.model('LotteryResult', lotteryResultSchema);

module.exports = LotteryResult; 