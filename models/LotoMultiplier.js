const mongoose = require('mongoose');

const lotoMultiplierSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    unique: true // Mỗi cửa hàng chỉ có một hệ số lô
  },
  multiplier: {
    type: Number,
    required: true,
    default: 22,
    min: 1,
    max: 100 // Giới hạn hợp lý cho hệ số
  },
  isActive: {
    type: Boolean,
    default: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index để tối ưu truy vấn
lotoMultiplierSchema.index({ storeId: 1 });

module.exports = mongoose.model('LotoMultiplier', lotoMultiplierSchema); 