const mongoose = require('mongoose');

const lotteryResultSchema = new mongoose.Schema({
  turnNum: {
    type: String,
    required: true,
    unique: true, // Chỉ có một kết quả xổ số cho mỗi turnNum
    index: true
  },
  openTime: {
    type: Date,
    required: true,
    index: true
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
  }
  // Loại bỏ storeId và adminId - tất cả store sử dụng chung kết quả
}, {
  timestamps: true
});

// Index for efficient querying
lotteryResultSchema.index({ turnNum: -1 });
lotteryResultSchema.index({ openTime: -1 });

const LotteryResult = mongoose.model('LotteryResult', lotteryResultSchema);

module.exports = LotteryResult; 