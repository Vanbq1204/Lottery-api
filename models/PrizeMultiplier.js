const mongoose = require('mongoose');

const prizeMultiplierSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  betType: {
    type: String,
    required: true,
    enum: [
      'loto', '2s', '3s', '4s', 'tong', 'kep', 'dau', 'dit', 'bo', 'xien', 'xienquay',
      // 3s betTypes
      '3s_gdb', '3s_gdb_g1', '3s_gdb2_g1', '3s_g1', '3s_g6', '3s_2digits_gdb',
      // Xiên betTypes
      'xien2_full', 'xien2_1hit', 'xien3_full', 'xien3_2hit_both', 'xien3_2hit_one',
      'xien4_full', 'xien4_3hit_all', 'xien4_3hit_two', 'xien4_3hit_one',
      // Xiên quay betTypes
      'xienquay4_full', 'xienquay4_3con', 'xienquay4_2con', 'xienquay3_full', 'xienquay3_2con'
    ]
  },
  subType: {
    type: String,
    default: null // For 3s: 'gdb', 'gdb_g1', 'gdb_2digits_g1', 'g1', 'g6'
  },
  multiplier: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Compound unique index - thêm storeId để mỗi store có hệ số riêng
prizeMultiplierSchema.index({ storeId: 1, betType: 1, subType: 1 }, { unique: true });

// Middleware để cập nhật updatedAt khi có thay đổi
prizeMultiplierSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PrizeMultiplier', prizeMultiplierSchema);