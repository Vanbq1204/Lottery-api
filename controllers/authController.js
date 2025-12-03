const User = require('../models/User');
const Store = require('../models/Store');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const GlobalSettings = require('../models/GlobalSettings');

// Tạo JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Đăng nhập
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Kiểm tra input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu'
      });
    }

    // Tìm user
    const user = await User.findOne({ username }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
    }

    // Kiểm tra password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
    }

    // Kiểm tra tài khoản có active không
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị khóa'
      });
    }

    // Kiểm tra hết hạn cho employee (nhân viên)
    if (user.role === 'employee' && user.storeId) {
      const store = await Store.findById(user.storeId);
      if (store && store.endDate) {
        const now = new Date();
        if (new Date(store.endDate) < now) {
          return res.status(401).json({
            success: false,
            message: 'Tài khoản đã hết hạn. Vui lòng liên hệ quản trị viên để gia hạn.'
          });
        }
      }
    }

    // Cập nhật last login
    user.lastLogin = new Date();
    await user.save();

    // Tạo token
    const token = generateToken(user._id);


    // Chuẩn bị thông tin user trả về
    const userResponse = {
      id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      storeName: user.storeName,
      storeId: user.storeId,
      allowChangePassword: user.allowChangePassword,
      allowMessageExport: user.allowMessageExport
    };

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server'
    });
  }
};

// Middleware xác thực token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Không có token xác thực'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị khóa'
      });
    }

    // Kiểm tra yêu cầu đăng nhập lại (force relogin) - miễn trừ Super Admin
    try {
      const settings = await GlobalSettings.findOne({ key: 'global' });
      if (settings?.forceReloginAt && user.role !== 'superadmin') {
        const forcedAtSec = Math.floor(new Date(settings.forceReloginAt).getTime() / 1000);
        const tokenIssuedAtSec = decoded.iat || 0; // iat mặc định của JWT
        if (tokenIssuedAtSec < forcedAtSec) {
          return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập lại' });
        }
      }
    } catch (e) {
      // Nếu lỗi khi đọc settings thì bỏ qua, không chặn
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ'
    });
  }
};

// Middleware kiểm tra quyền
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Chưa xác thực'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền truy cập'
      });
    }

    next();
  };
};

// Lấy thông tin user hiện tại
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy user'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server'
    });
  }
};

// Middleware yêu cầu quyền admin


// Đổi mật khẩu (dành cho user tự đổi) - xác thực mật khẩu cũ
const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    // Lấy user kèm password để so sánh
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    const isValid = await user.comparePassword(oldPassword);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Mật khẩu cũ không đúng' });
    }

    user.password = newPassword; // sẽ được hash qua pre('save')
    await user.save();

    res.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi đổi mật khẩu' });
  }
};

module.exports = {
  login,
  authenticateToken,
  requireRole,

  getProfile,
  changePassword
};