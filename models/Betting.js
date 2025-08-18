const mongoose = require('mongoose');

const bettingSchema = new mongoose.Schema({
  // Thông tin khách hàng
  customerName: {
    type: String,
    trim: true,
    default: ''
  },
  customerPhone: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Thông tin cược
  betType: {
    type: String,
    enum: ['lo2so', 'lo3so', 'xien2', 'xien3', 'dau', 'duoi'],
    required: true
  },
  numbers: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1000
  },
  province: {
    type: String,
    enum: ['mienbac', 'mientrung', 'miennam'],
    required: true
  },
  
  // Thông tin hệ thống
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
  
  // Kết quả
  isWin: {
    type: Boolean,
    default: null
  },
  winAmount: {
    type: Number,
    default: 0
  },
  
  // Trạng thái
  status: {
    type: String,
    enum: ['pending', 'processed', 'cancelled'],
    default: 'pending'
  },
  
  // Ngày xổ
  drawDate: {
    type: Date,
    default: function() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }
  }
}, {
  timestamps: true
});

// Index để tăng tốc độ truy vấn
bettingSchema.index({ employeeId: 1, createdAt: -1 });
bettingSchema.index({ storeId: 1, drawDate: 1 });
bettingSchema.index({ adminId: 1, drawDate: 1 });
bettingSchema.index({ drawDate: 1, status: 1 });

module.exports = mongoose.model('Betting', bettingSchema); 