const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Store = require('../models/Store');
const PrizeMultiplier = require('../models/PrizeMultiplier');

const initProductionData = async () => {
  try {
    console.log('🚀 Khởi tạo dữ liệu production...');
    
    // Kết nối MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB');

    // 1. Tạo Super Admin
    const existingSuperAdmin = await User.findOne({ username: 'superadmin' });
    if (!existingSuperAdmin) {
      const superAdmin = new User({
        username: 'superadmin',
        password: '123456', // Sẽ được hash tự động
        name: 'Super Administrator',
        email: 'superadmin@loto.com',
        role: 'superadmin',
        isActive: true
      });
      await superAdmin.save();
      console.log('✅ Đã tạo Super Admin');
    }

    // 2. Tạo Store mẫu
    let store = await Store.findOne({ name: 'Cửa hàng chính' });
    if (!store) {
      store = new Store({
        name: 'Cửa hàng chính',
        address: '123 Đường ABC, Quận 1, TP.HCM',
        phone: '0123456789',
        isActive: true
      });
      await store.save();
      console.log('✅ Đã tạo Store mẫu');
    }

    // 3. Tạo Admin cho store
    const existingAdmin = await User.findOne({ username: 'admin1' });
    if (!existingAdmin) {
      const admin = new User({
        username: 'admin1',
        password: '123456',
        name: 'Admin Cửa hàng chính',
        email: 'admin1@loto.com',
        role: 'admin',
        storeId: store._id,
        isActive: true
      });
      await admin.save();
      console.log('✅ Đã tạo Admin');
    }

    // 4. Tạo Employee cho store
    const existingEmployee = await User.findOne({ username: 'nhanvien1' });
    if (!existingEmployee) {
      const employee = new User({
        username: 'nhanvien1',
        password: '123456',
        name: 'Nhân viên 1',
        email: 'nhanvien1@loto.com',
        role: 'employee',
        storeId: store._id,
        isActive: true
      });
      await employee.save();
      console.log('✅ Đã tạo Employee');
    }

    // 5. Khởi tạo hệ số thưởng
    const existingMultipliers = await PrizeMultiplier.countDocuments({ storeId: store._id });
    if (existingMultipliers === 0) {
      const defaultMultipliers = [
        { betType: 'loto', multiplier: 22, description: 'Hệ số thưởng lô tô' },
        { betType: '2s', multiplier: 85, description: 'Hệ số thưởng 2 số' },
        { betType: 'tong', multiplier: 85, description: 'Hệ số thưởng tổng' },
        { betType: 'dau', multiplier: 85, description: 'Hệ số thưởng đầu' },
        { betType: 'dit', multiplier: 85, description: 'Hệ số thưởng đít' },
        { betType: 'kep', multiplier: 85, description: 'Hệ số thưởng kép' },
        { betType: 'bo', multiplier: 85, description: 'Hệ số thưởng bộ' },
        // 3s multipliers
        { betType: '3s_gdb', multiplier: 450, description: '3 số trúng GĐB' },
        { betType: '3s_g1', multiplier: 300, description: '3 số trúng G1' },
        { betType: '3s_g2', multiplier: 150, description: '3 số trúng G2' },
        { betType: '3s_g3', multiplier: 150, description: '3 số trúng G3' },
        { betType: '3s_g4_to_g7', multiplier: 80, description: '3 số trúng G4-G7' },
        // Xiên multipliers
        { betType: 'xien2_full', multiplier: 12, description: 'Xiên 2 full' },
        { betType: 'xien2_1hit', multiplier: 2, description: 'Xiên 2 trúng 1' },
        { betType: 'xien3_full', multiplier: 55, description: 'Xiên 3 full' },
        { betType: 'xien3_2hit_both', multiplier: 8, description: 'Xiên 3 trúng 2 (cả 2)' },
        { betType: 'xien3_2hit_one', multiplier: 4, description: 'Xiên 3 trúng 2 (1 con)' },
        { betType: 'xien4_full', multiplier: 120, description: 'Xiên 4 full' },
        { betType: 'xien4_3hit_all', multiplier: 15, description: 'Xiên 4 trúng 3 (tất cả)' },
        { betType: 'xien4_3hit_two', multiplier: 8, description: 'Xiên 4 trúng 3 (2 con)' },
        { betType: 'xien4_3hit_one', multiplier: 4, description: 'Xiên 4 trúng 3 (1 con)' },
        // Xiên quay multipliers
        { betType: 'xienquay3_full', multiplier: 18, description: 'Xiên quay 3 full' },
        { betType: 'xienquay3_2con', multiplier: 3, description: 'Xiên quay 3 trúng 2' },
        { betType: 'xienquay4_full', multiplier: 72, description: 'Xiên quay 4 full' },
        { betType: 'xienquay4_3con', multiplier: 12, description: 'Xiên quay 4 trúng 3' },
        { betType: 'xienquay4_2con', multiplier: 2, description: 'Xiên quay 4 trúng 2' }
      ];

      for (const multiplierData of defaultMultipliers) {
        const multiplier = new PrizeMultiplier({
          ...multiplierData,
          storeId: store._id,
          isActive: true
        });
        await multiplier.save();
      }
      console.log('✅ Đã khởi tạo hệ số thưởng');
    }

    console.log('');
    console.log('🎉 KHỞI TẠO PRODUCTION THÀNH CÔNG!');
    console.log('');
    console.log('📋 Thông tin đăng nhập:');
    console.log('   Super Admin: superadmin / 123456');
    console.log('   Admin: admin1 / 123456');
    console.log('   Employee: nhanvien1 / 123456');
    console.log('');
    console.log('🏪 Store ID:', store._id.toString());
    
  } catch (error) {
    console.error('❌ Lỗi khởi tạo:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Đã ngắt kết nối MongoDB');
    process.exit(0);
  }
};

// Chạy script
initProductionData(); 