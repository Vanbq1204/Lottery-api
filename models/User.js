const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'employee'],
    required: true
  },
  // Thông tin cho Super Admin
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Thông tin cho Admin
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Super Admin hoặc Admin cha
    default: null
  },
  monthlyFee: {
    type: Number,
    default: 0 // Phí hàng tháng mà admin phải trả
  },
  feeStatus: {
    type: String,
    enum: ['paid', 'pending', 'overdue'],
    default: 'paid'
  },
  
  // Thông tin cho Employee
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    default: null
  },
  storeName: {
    type: String,
    default: ''
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Hash password trước khi lưu
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// So sánh password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Lấy thông tin user không bao gồm password
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Quyền hiển thị UI
// Cho phép đổi mật khẩu (áp dụng mọi role)
if (!module.exports?.schema?.path('allowChangePassword')) {
  userSchema.add({
    allowChangePassword: { type: Boolean, default: true }
  });
}

// Cho phép sử dụng Xuất tin nhắn (áp dụng chủ yếu cho admin)
if (!module.exports?.schema?.path('allowMessageExport')) {
  userSchema.add({
    allowMessageExport: { type: Boolean, default: true }
  });
}

module.exports = mongoose.model('User', userSchema);