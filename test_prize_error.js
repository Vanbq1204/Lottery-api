require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

// Kết nối database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
console.log('🔗 Connecting to:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    testPrizeCalculation();
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
  });

const testPrizeCalculation = async () => {
  try {
    console.log('🧪 Test tính thưởng với API...\n');
    
    const testDate = '2025-08-20';
    
    // Test API tính thưởng
    console.log('1️⃣ Test API tính thưởng:');
    try {
      const response = await axios.post('http://localhost:5000/api/prize/calculate', {
        date: testDate
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        timeout: 10000
      });
      
      console.log('✅ API Response:', response.data);
    } catch (error) {
      console.log('❌ API Error:');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message);
      console.log('   Error:', error.response?.data?.error);
      console.log('   Full error:', error.message);
      
      if (error.response?.status === 403) {
        console.log('\n💡 Vấn đề: Lỗi 403 - Cần token authentication hợp lệ');
        console.log('   Giải pháp: Kiểm tra token trong localStorage hoặc đăng nhập lại');
      } else if (error.response?.status === 500) {
        console.log('\n💡 Vấn đề: Lỗi 500 - Server error');
        console.log('   Cần kiểm tra log server để xem lỗi cụ thể');
      }
    }
    
    // Test API với token thật
    console.log('\n2️⃣ Test với token thật:');
    try {
      // Lấy token từ localStorage (nếu có)
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGEzN2JhNTViZDE2YmJkMjJiNGEwMzQiLCJ1c2VybmFtZSI6Im5oYW52aWVuMiIsInJvbGUiOiJlbXBsb3llZSIsInN0b3JlSWQiOiI2OGEzN2JhNTViZDE2YmJkMjJiNGEwMzYiLCJpYXQiOjE3MzQ3NzQ5NzQsImV4cCI6MTczNDc3ODU3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';
      
      const response = await axios.post('http://localhost:5000/api/prize/calculate', {
        date: testDate
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000
      });
      
      console.log('✅ API Response with token:', response.data);
    } catch (error) {
      console.log('❌ API Error with token:');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message);
      console.log('   Error:', error.response?.data?.error);
    }
    
    // Test production URL
    console.log('\n3️⃣ Test production URL:');
    try {
      const response = await axios.post('https://loto-web-backend.onrender.com/api/prize/calculate', {
        date: testDate
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        timeout: 15000
      });
      
      console.log('✅ Production API Response:', response.data);
    } catch (error) {
      console.log('❌ Production API Error:');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message);
      console.log('   Error:', error.response?.data?.error);
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    mongoose.connection.close();
  }
}; 