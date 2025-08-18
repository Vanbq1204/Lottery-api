const User = require('../models/User');
const Store = require('../models/Store');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const storeController = require('./storeController');

// Lấy danh sách tất cả admin
const getAllAdmins = async (req, res) => {
  try {
    const superAdminId = req.user.id;
    
    // Lấy tất cả admin có parentId là superadmin hiện tại
    const admins = await User.find({
      role: 'admin',
      parentId: new mongoose.Types.ObjectId(superAdminId)
    }).populate('storeId', 'name address phone');
    
    res.json({
      success: true,
      admins: admins.map(admin => ({
        id: admin._id,
        username: admin.username,
        name: admin.name,
        email: admin.email,
        isActive: admin.isActive,
        storeId: admin.storeId?._id,
        storeName: admin.storeId?.name,
        storeAddress: admin.storeId?.address,
        storePhone: admin.storeId?.phone,
        createdAt: admin.createdAt
      }))
    });
    
  } catch (error) {
    console.error('Lỗi lấy danh sách admin:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách admin'
    });
  }
};

// Tạo tài khoản admin mới
const createAdmin = async (req, res) => {
  try {
    const { username, password, name, email, storeId } = req.body;
    const superAdminId = req.user.id;
    
    // Validate input
    if (!username || !password || !name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin: username, password, name, email'
      });
    }
    
    // Kiểm tra username đã tồn tại
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username đã tồn tại'
      });
    }
    
    // Kiểm tra email đã tồn tại
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email đã tồn tại'
      });
    }
    
    // Tạm thời bỏ qua storeId validation
    let store = null;
    if (storeId) {
      store = await Store.findById(storeId);
      if (!store) {
        return res.status(400).json({
          success: false,
          message: 'Cửa hàng không tồn tại'
        });
      }
      
      // Kiểm tra store đã có admin chưa
      const existingAdmin = await User.findOne({ 
        role: 'admin', 
        storeId: new mongoose.Types.ObjectId(storeId) 
      });
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Cửa hàng này đã có admin'
        });
      }
    }
    
    // Password sẽ được hash tự động trong pre('save') hook
    
    // Tạo admin mới
    const adminData = {
      username,
      password, // Plain password, sẽ được hash tự động
      name,
      email,
      role: 'admin',
      parentId: new mongoose.Types.ObjectId(superAdminId),
      isActive: true
    };

    if (storeId) {
      adminData.storeId = new mongoose.Types.ObjectId(storeId);
    }

    console.log('Creating admin with data:', adminData);
    const newAdmin = new User(adminData);
    
    const savedAdmin = await newAdmin.save();
    console.log('Admin saved successfully:', savedAdmin._id);
    
    // Cập nhật adminId cho store nếu có
    if (storeId) {
      await Store.updateOne(
        { _id: storeId },
        { adminId: newAdmin._id }
      );
    }
    
    res.json({
      success: true,
      message: 'Tạo tài khoản admin thành công',
      admin: {
        id: savedAdmin._id,
        username: savedAdmin.username,
        name: savedAdmin.name,
        email: savedAdmin.email,
        isActive: savedAdmin.isActive,
        storeId: storeId,
        storeName: store?.name || 'Chưa gán cửa hàng'
      }
    });
    
  } catch (error) {
    console.error('Lỗi tạo admin:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo admin'
    });
  }
};

// Cập nhật thông tin admin
const updateAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { name, email, isActive, password } = req.body;
    const superAdminId = req.user.id;
    
    // Kiểm tra admin tồn tại và thuộc về superadmin này
    const admin = await User.findOne({
      _id: new mongoose.Types.ObjectId(adminId),
      role: 'admin',
      parentId: new mongoose.Types.ObjectId(superAdminId)
    });
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy admin hoặc bạn không có quyền chỉnh sửa'
      });
    }
    
    // Chuẩn bị dữ liệu cập nhật
    const updateData = {};
    if (name) updateData.name = name;
    if (email) {
      // Kiểm tra email đã tồn tại (trừ admin hiện tại)
      const existingEmail = await User.findOne({ 
        email, 
        _id: { $ne: adminId } 
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email đã tồn tại'
        });
      }
      updateData.email = email;
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Tìm admin và cập nhật
    const adminToUpdate = await User.findOne({
      _id: new mongoose.Types.ObjectId(adminId),
      role: 'admin',
      parentId: new mongoose.Types.ObjectId(superAdminId)
    });
    
    if (!adminToUpdate) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy admin hoặc bạn không có quyền cập nhật'
      });
    }
    
    // Cập nhật các field
    if (name) adminToUpdate.name = name;
    if (email) adminToUpdate.email = email;
    if (password) adminToUpdate.password = password; // Plain password, sẽ được hash tự động
    if (isActive !== undefined) adminToUpdate.isActive = isActive;
    
    await adminToUpdate.save(); // Trigger pre('save') hook
    
    res.json({
      success: true,
      message: 'Cập nhật thông tin admin thành công'
    });
    
  } catch (error) {
    console.error('Lỗi cập nhật admin:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật admin'
    });
  }
};

// Xóa admin
const deleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const superAdminId = req.user.id;
    
    // Kiểm tra admin tồn tại và thuộc về superadmin này
    const admin = await User.findOne({
      _id: new mongoose.Types.ObjectId(adminId),
      role: 'admin',
      parentId: new mongoose.Types.ObjectId(superAdminId)
    });
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy admin hoặc bạn không có quyền xóa'
      });
    }
    
    // Xóa adminId khỏi store
    if (admin.storeId) {
      await Store.updateOne(
        { _id: admin.storeId },
        { $unset: { adminId: "" } }
      );
    }
    
    // Xóa admin
    await User.deleteOne({ _id: adminId });
    
    res.json({
      success: true,
      message: 'Xóa admin thành công'
    });
    
  } catch (error) {
    console.error('Lỗi xóa admin:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa admin'
    });
  }
};

// Lấy danh sách stores chưa có admin
const getAvailableStores = async (req, res) => {
  try {
    const superAdminId = req.user.id;
    
    // Lấy các stores chưa có admin hoặc admin không hoạt động
    const stores = await Store.find({
      $or: [
        { adminId: { $exists: false } },
        { adminId: null }
      ]
    });
    
    res.json({
      success: true,
      stores: stores.map(store => ({
        id: store._id,
        name: store.name,
        address: store.address,
        phone: store.phone
      }))
    });
    
  } catch (error) {
    console.error('Lỗi lấy danh sách stores:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách stores'
    });
  }
};

module.exports = {
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getAvailableStores,
  // Store management functions
  getStoresByAdmin: storeController.getStoresByAdmin,
  createStore: storeController.createStore,
  updateStore: storeController.updateStore,
  deleteStore: storeController.deleteStore
}; 