const mongoose = require('mongoose');
const { getVietnamDayRange, debugVietnamDayRange } = require('./utils/dateUtils');

// Test timezone issue
const testTimezoneIssue = () => {
  console.log('🔍 Testing timezone issue...\n');
  
  // Test date: 2025-01-19
  const testDate = '2025-01-19';
  
  console.log('📅 Testing getVietnamDayRange for date:', testDate);
  const debug = debugVietnamDayRange(testDate);
  console.log('Debug info:', JSON.stringify(debug, null, 2));
  
  console.log('\n🔍 Testing how lotteryDate is created:');
  
  // Simulate how lotteryDate is created in calculateInvoicePrize
  const lotteryDate = new Date(2025, 0, 19); // January 19, 2025
  console.log('Original lotteryDate:', lotteryDate.toISOString());
  console.log('Original lotteryDate (local):', lotteryDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
  
  // How it's currently created in the code (OLD METHOD)
  const currentLotteryDate = new Date(lotteryDate.getFullYear(), lotteryDate.getMonth(), lotteryDate.getDate());
  console.log('OLD - Current lotteryDate (UTC):', currentLotteryDate.toISOString());
  console.log('OLD - Current lotteryDate (local):', currentLotteryDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
  
  // NEW METHOD - Using inputDate directly
  const vietnamLotteryDate = new Date(testDate + 'T00:00:00+07:00');
  console.log('NEW - Vietnam lotteryDate (UTC):', vietnamLotteryDate.toISOString());
  console.log('NEW - Vietnam lotteryDate (local):', vietnamLotteryDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
  
  console.log('\n🔍 Testing query ranges:');
  const { startOfDay, endOfDay } = getVietnamDayRange(testDate);
  console.log('Query range startOfDay:', startOfDay.toISOString());
  console.log('Query range endOfDay:', endOfDay.toISOString());
  
  console.log('\n🔍 Testing if OLD lotteryDate falls within range:');
  console.log('OLD lotteryDate >= startOfDay:', currentLotteryDate >= startOfDay);
  console.log('OLD lotteryDate <= endOfDay:', currentLotteryDate <= endOfDay);
  console.log('OLD lotteryDate in range:', currentLotteryDate >= startOfDay && currentLotteryDate <= endOfDay);
  
  console.log('\n🔍 Testing if NEW lotteryDate falls within range:');
  console.log('NEW lotteryDate >= startOfDay:', vietnamLotteryDate >= startOfDay);
  console.log('NEW lotteryDate <= endOfDay:', vietnamLotteryDate <= endOfDay);
  console.log('NEW lotteryDate in range:', vietnamLotteryDate >= startOfDay && vietnamLotteryDate <= endOfDay);
  
  console.log('\n🔍 Testing what happens on production server (UTC):');
  
  // Simulate production server behavior
  const productionStartOfDay = new Date('2025-01-19T00:00:00.000Z');
  const productionEndOfDay = new Date('2025-01-19T23:59:59.999Z');
  
  console.log('Production query range:');
  console.log('  startOfDay:', productionStartOfDay.toISOString());
  console.log('  endOfDay:', productionEndOfDay.toISOString());
  
  console.log('\nTesting OLD lotteryDate with production range:');
  console.log('  OLD lotteryDate >= productionStartOfDay:', currentLotteryDate >= productionStartOfDay);
  console.log('  OLD lotteryDate <= productionEndOfDay:', currentLotteryDate <= productionEndOfDay);
  console.log('  OLD lotteryDate in production range:', currentLotteryDate >= productionStartOfDay && currentLotteryDate <= productionEndOfDay);
  
  console.log('\nTesting NEW lotteryDate with production range:');
  console.log('  NEW lotteryDate >= productionStartOfDay:', vietnamLotteryDate >= productionStartOfDay);
  console.log('  NEW lotteryDate <= productionEndOfDay:', vietnamLotteryDate <= productionEndOfDay);
  console.log('  NEW lotteryDate in production range:', vietnamLotteryDate >= productionStartOfDay && vietnamLotteryDate <= productionEndOfDay);
  
  console.log('\n✅ CONCLUSION:');
  if (vietnamLotteryDate >= startOfDay && vietnamLotteryDate <= endOfDay) {
    console.log('✅ NEW method works correctly with Vietnam timezone range');
  } else {
    console.log('❌ NEW method still has issues');
  }
  
  if (vietnamLotteryDate >= productionStartOfDay && vietnamLotteryDate <= productionEndOfDay) {
    console.log('✅ NEW method works correctly with production UTC range');
  } else {
    console.log('❌ NEW method has issues with production UTC range');
  }
};

// Run test
testTimezoneIssue(); 