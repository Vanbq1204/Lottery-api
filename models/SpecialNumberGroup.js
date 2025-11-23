const mongoose = require('mongoose');

const specialNumberGroupSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  betType: {
    type: String,
    enum: ['2s', 'bo'],
    default: '2s',
    required: true
  },
  numbers: {
    type: [String],
    default: [],
    validate: {
      validator: function(arr) {
        return Array.isArray(arr) && arr.every(n => /^\d{2}$/.test(n));
      },
      message: 'Danh sách số chỉ chứa chuỗi 2 chữ số (00-99)'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Đảm bảo tên nhóm là duy nhất trong mỗi cửa hàng cho mỗi loại cược
specialNumberGroupSchema.index({ storeId: 1, betType: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('SpecialNumberGroup', specialNumberGroupSchema);