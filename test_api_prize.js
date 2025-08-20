require('dotenv').config();
const axios = require('axios');

const testApiPrize = async () => {
  try {
    console.log('🧪 Test API tính thưởng...\n');
    
    // Test với ngày 20/8/2025
    const testDate = '2025-08-20';
    const apiUrl = process.env.API_URL || 'http://localhost:5000';
    
    console.log(`📅 Test date: ${testDate}`);
    console.log(`🔗 API URL: ${apiUrl}`);
    
    // 1. Test tính thưởng
    console.log('\n1️⃣ Test tính thưởng:');
    try {
      const response = await axios.post(`${apiUrl}/api/prize/calculate`, {
        date: testDate
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Response:', response.data);
    } catch (error) {
      console.log('❌ Error:', error.response?.data || error.message);
    }
    
    // 2. Test lấy hóa đơn thưởng
    console.log('\n2️⃣ Test lấy hóa đơn thưởng:');
    try {
      const response = await axios.get(`${apiUrl}/api/prize/winning-invoices`, {
        params: {
          date: testDate
        }
      });
      
      console.log('✅ Response:', response.data);
    } catch (error) {
      console.log('❌ Error:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  }
};

testApiPrize(); 