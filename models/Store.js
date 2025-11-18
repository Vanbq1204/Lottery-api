const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  address: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  phone: {
    type: String,
    trim: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  // Quyền hiển thị các tab kết quả trong giao diện nhân viên
  showLotteryResults: {
    type: Boolean,
    default: false
  },
  showQuickLotteryResults: {
    type: Boolean,
    default: false
  },
  // Thống kê
  totalBetsToday: {
    type: Number,
    default: 0
  },
  totalAmountToday: {
    type: Number,
    default: 0
  },
  lastResetDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Store', storeSchema);