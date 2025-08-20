require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

const testLotteryDuplicate = async () => {
  try {
    console.log('🧪 Test logic trùng lặp kết quả xổ số...\n');
    
    // Test data
    const lotteryData = {
      turnNum: 'TEST001',
      openTime: new Date('2025-01-20T18:00:00Z'),
      openNum: '12345',
      results: {
        gdb: '12345',
        g1: '67890',
        g2: ['11111', '22222'],
        g3: ['33333', '44444', '55555'],
        g4: ['66666', '77777', '88888', '99999'],
        g5: ['00000', '11111', '22222', '33333', '44444'],
        g6: ['55555', '66666', '77777', '88888', '99999', '00000'],
        g7: ['11111', '22222', '33333', '44444', '55555', '66666', '77777']
      }
    };
    
    console.log('1️⃣ Test lưu kết quả xổ số lần đầu:');
    try {
      const response1 = await axios.post('http://localhost:5001/api/lottery/save', lotteryData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGEzN2JhNTViZDE2YmJkMjJiNGEwMzgiLCJpYXQiOjE3NTU2NTAzMDQsImV4cCI6MTc1NTY1MzkwNH0.ocyQOPkU5Dq4sUQMrtQkcWEIIU_a3qPqWNwYCtmvdfE'
        },
        timeout: 10000
      });
      
      console.log('✅ Lần 1 - Success:');
      console.log('   Message:', response1.data.message);
      console.log('   TurnNum:', response1.data.lotteryResult?.turnNum);
    } catch (error) {
      console.log('❌ Lần 1 - Error:');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message);
    }
    
    console.log('\n2️⃣ Test lưu kết quả xổ số lần thứ 2 (trùng lặp):');
    try {
      const response2 = await axios.post('http://localhost:5001/api/lottery/save', lotteryData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGEzN2JhNTViZDE2YmJkMjJiNGEwMzgiLCJpYXQiOjE3NTU2NTAzMDQsImV4cCI6MTc1NTY1MzkwNH0.ocyQOPkU5Dq4sUQMrtQkcWEIIU_a3qPqWNwYCtmvdfE'
        },
        timeout: 10000
      });
      
      console.log('❌ Lần 2 - Unexpected Success:');
      console.log('   Message:', response2.data.message);
    } catch (error) {
      console.log('✅ Lần 2 - Expected Error:');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message);
      
      if (error.response?.status === 400 && error.response?.data?.message.includes('Đã có kết quả xổ số')) {
        console.log('   🎯 Đúng: Đã từ chối lưu trùng lặp!');
      } else {
        console.log('   ❌ Sai: Không phải lỗi trùng lặp mong đợi');
      }
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  }
};

testLotteryDuplicate(); 