require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

const testTurnNumLogic = async () => {
  try {
    console.log('🧪 Test logic tính thưởng theo turnNum...\n');
    
    // Test với ngày 19/8 (có kết quả xổ số)
    console.log('1️⃣ Test ngày 19/8 (có kết quả xổ số):');
    try {
      const response = await axios.post('http://localhost:5001/api/prize/calculate', {
        date: '2025-08-19'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGEzN2JhNTViZDE2YmJkMjJiNGEwMzgiLCJpYXQiOjE3NTU2NTAzMDQsImV4cCI6MTc1NTY1MzkwNH0.ocyQOPkU5Dq4sUQMrtQkcWEIIU_a3qPqWNwYCtmvdfE'
        },
        timeout: 10000
      });
      
      console.log('✅ Ngày 19/8 Response:');
      console.log('   Message:', response.data.message);
      console.log('   Winning invoices:', response.data.winningInvoices?.length || 0);
    } catch (error) {
      console.log('❌ Ngày 19/8 Error:');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message);
    }
    
    // Test với ngày 20/8 (không có kết quả xổ số)
    console.log('\n2️⃣ Test ngày 20/8 (không có kết quả xổ số):');
    try {
      const response = await axios.post('http://localhost:5001/api/prize/calculate', {
        date: '2025-08-20'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGEzN2JhNTViZDE2YmJkMjJiNGEwMzgiLCJpYXQiOjE3NTU2NTAzMDQsImV4cCI6MTc1NTY1MzkwNH0.ocyQOPkU5Dq4sUQMrtQkcWEIIU_a3qPqWNwYCtmvdfE'
        },
        timeout: 10000
      });
      
      console.log('✅ Ngày 20/8 Response:');
      console.log('   Message:', response.data.message);
      console.log('   Winning invoices:', response.data.winningInvoices?.length || 0);
    } catch (error) {
      console.log('❌ Ngày 20/8 Error:');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message);
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  }
};

testTurnNumLogic(); 