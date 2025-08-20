require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';

// Kết nối database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
console.log('🔗 Connecting to:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    debugToken();
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
  });

const debugToken = async () => {
  try {
    console.log('🔍 Debug token authentication...\n');
    
    // 1. Tìm user nhanvien2
    console.log('1️⃣ Tìm user nhanvien2:');
    const user = await User.findOne({ username: 'nhanvien2' });
    
    if (!user) {
      console.log('❌ Không tìm thấy user nhanvien2');
      return;
    }
    
    console.log('✅ Tìm thấy user:');
    console.log(`   ID: ${user._id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   StoreId: ${user.storeId}`);
    console.log(`   IsActive: ${user.isActive}`);
    
    // 2. Tạo token mới
    console.log('\n2️⃣ Tạo token mới:');
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    console.log(`   Token: ${token}`);
    
    // 3. Verify token
    console.log('\n3️⃣ Verify token:');
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token hợp lệ:');
      console.log(`   Decoded:`, decoded);
      
      // 4. Tìm user từ token
      const userFromToken = await User.findById(decoded.userId);
      if (userFromToken) {
        console.log('✅ Tìm thấy user từ token:');
        console.log(`   Username: ${userFromToken.username}`);
        console.log(`   Role: ${userFromToken.role}`);
        console.log(`   StoreId: ${userFromToken.storeId}`);
      } else {
        console.log('❌ Không tìm thấy user từ token');
      }
    } catch (error) {
      console.log('❌ Token không hợp lệ:', error.message);
    }
    
    // 5. Test token cũ
    console.log('\n4️⃣ Test token cũ:');
    const oldToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGEzN2JhNTViZDE2YmJkMjJiNGEwMzQiLCJ1c2VybmFtZSI6Im5oYW52aWVuMiIsInJvbGUiOiJlbXBsb3llZSIsInN0b3JlSWQiOiI2OGEzN2JhNTViZDE2YmJkMjJiNGEwMzYiLCJpYXQiOjE3MzQ3NzQ5NzQsImV4cCI6MTczNDc3ODU3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';
    
    try {
      const decodedOld = jwt.verify(oldToken, JWT_SECRET);
      console.log('✅ Token cũ hợp lệ:', decodedOld);
    } catch (error) {
      console.log('❌ Token cũ không hợp lệ:', error.message);
    }
    
    // 6. Kiểm tra JWT_SECRET
    console.log('\n5️⃣ Kiểm tra JWT_SECRET:');
    console.log(`   JWT_SECRET: ${JWT_SECRET}`);
    console.log(`   Length: ${JWT_SECRET.length}`);
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    mongoose.connection.close();
  }
}; 