
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Cấu hình CORS cho production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, 'https://vjamin.vercel.app/']
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes = require('./routes/authRoutes');
const bettingRoutes = require('./routes/bettingRoutes');
const lotteryRoutes = require('./routes/lotteryRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const prizeRoutes = require('./routes/prizeRoutes');
const prizeStatsRoutes = require('./routes/prizeStatsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const employeeRoutes = require('./routes/employeeRoutes');


app.use('/api/auth', authRoutes);
app.use('/api/betting', bettingRoutes);
app.use('/api/lottery', lotteryRoutes);
app.use('/api/invoice', invoiceRoutes);
app.use('/api/prize', prizeRoutes);
app.use('/api/prize-stats', prizeStatsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/employee', employeeRoutes);


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Lottery System API is running',
    timestamp: new Date().toISOString()
  });
});

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    // Tạo dữ liệu mẫu nếu cần
    initializeData().catch(err => {
      console.error('❌ Error initializing data:', err);
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    // Không exit process, chỉ log error
  });

// Khởi tạo dữ liệu mẫu
async function initializeData() {
  try {
    const User = require('./models/User');
    const Store = require('./models/Store');
    
    // Kiểm tra xem đã có Super Admin chưa
    const superAdmin = await User.findOne({ role: 'superadmin' });
    
    if (!superAdmin) {
      console.log('🔧 Creating sample data...');
      
      // Tạo Super Admin
      const newSuperAdmin = new User({
        username: 'superadmin',
        password: '123456',
        name: 'Super Administrator',
        email: 'superadmin@lottery.com',
        role: 'superadmin'
      });
      await newSuperAdmin.save();
      console.log('✅ Super Admin created: superadmin/123456');
      
      // Tạo Admin mẫu
      const newAdmin = new User({
        username: 'admin1',
        password: '123456',
        name: 'Admin Store 1',
        email: 'admin1@lottery.com',
        role: 'admin',
        parentId: newSuperAdmin._id,
        monthlyFee: 500000
      });
      await newAdmin.save();
      console.log('✅ Admin created: admin1/123456');
      
      // Tạo Store mẫu
      const newStore = new Store({
        name: '92 NGUYỄN AN NINH',
        address: '92 Nguyễn An Ninh, Quận Tân Phú, TP.HCM',
        phone: '0901234567',
        adminId: newAdmin._id
      });
      await newStore.save();
      console.log('✅ Store created');
      
      // Tạo Employee mẫu
      const newEmployee = new User({
        username: 'nhanvien1',
        password: '123456',
        name: 'Nhân viên 1',
        role: 'employee',
        storeId: newStore._id,
        storeName: newStore.name,
        createdBy: newAdmin._id
      });
      await newEmployee.save();
      console.log('✅ Employee created: nhanvien1/123456');
      
      // Cập nhật store với employee
      newStore.employees.push(newEmployee._id);
      await newStore.save();
      
      console.log('🎉 Sample data initialization completed!');
      console.log('📝 Login credentials:');
      console.log('   Super Admin: superadmin/123456');
      console.log('   Admin: admin1/123456'); 
      console.log('   Employee: nhanvien1/123456');
    }
    
    // Khởi tạo hệ số thưởng mặc định
    const { initializeDefaultMultipliers } = require('./controllers/prizeController');
    await initializeDefaultMultipliers();
    
  } catch (error) {
    console.error('❌ Error initializing data:', error);
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

const PORT = process.env.PORT || 5001;

// Start server regardless of database connection
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 API URL: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
}); 