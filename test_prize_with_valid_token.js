require('dotenv').config();
const axios = require('axios');

const testPrizeWithValidToken = async () => {
  try {
    console.log('🧪 Test API tính thưởng với token hợp lệ...\n');
    
    const testDate = '2025-08-20';
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGEzN2JhNTViZDE2YmJkMjJiNGEwMzgiLCJpYXQiOjE3NTU2NTAzMDQsImV4cCI6MTc1NTY1MzkwNH0.ocyQOPkU5Dq4sUQMrtQkcWEIIU_a3qPqWNwYCtmvdfE';
    
    // Test local API (port 5001)
    console.log('1️⃣ Test local API (port 5001):');
    try {
      const response = await axios.post('http://localhost:5001/api/prize/calculate', {
        date: testDate
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validToken}`
        },
        timeout: 10000
      });
      
      console.log('✅ Local API Response:');
      console.log('   Message:', response.data.message);
      console.log('   Winning invoices:', response.data.winningInvoices?.length || 0);
      
      if (response.data.winningInvoices) {
        response.data.winningInvoices.forEach((inv, index) => {
          console.log(`   ${index + 1}. ${inv.originalInvoiceId} - ${inv.totalPrizeAmount} VNĐ`);
        });
      }
    } catch (error) {
      console.log('❌ Local API Error:');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message);
      console.log('   Error:', error.response?.data?.error);
    }
    
    // Test production API
    console.log('\n2️⃣ Test production API:');
    try {
      const response = await axios.post('https://loto-web-backend.onrender.com/api/prize/calculate', {
        date: testDate
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validToken}`
        },
        timeout: 15000
      });
      
      console.log('✅ Production API Response:');
      console.log('   Message:', response.data.message);
      console.log('   Winning invoices:', response.data.winningInvoices?.length || 0);
      
      if (response.data.winningInvoices) {
        response.data.winningInvoices.forEach((inv, index) => {
          console.log(`   ${index + 1}. ${inv.originalInvoiceId} - ${inv.totalPrizeAmount} VNĐ`);
        });
      }
    } catch (error) {
      console.log('❌ Production API Error:');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message);
      console.log('   Error:', error.response?.data?.error);
      
      if (error.response?.status === 500) {
        console.log('\n💡 Vấn đề: Lỗi 500 - Server error');
        console.log('   Có thể do:');
        console.log('   - Lỗi database connection');
        console.log('   - Lỗi logic tính thưởng');
        console.log('   - Lỗi timezone');
        console.log('   - Lỗi multiplier');
      }
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  }
};

testPrizeWithValidToken(); 