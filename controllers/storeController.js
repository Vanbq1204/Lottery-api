const User = require('../models/User');
const Store = require('../models/Store');
const mongoose = require('mongoose');
const { initializeDefaultMultipliers } = require('./prizeController');
const { initializeLotoMultiplier } = require('./lotoMultiplierController');

// Lấy danh sách stores của một admin
const getStoresByAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const superAdminId = req.user.id;
    
    // Kiểm tra admin có thuộc về superadmin này không
    const admin = await User.findOne({
      _id: new mongoose.Types.ObjectId(adminId),
      role: 'admin',
      parentId: new mongoose.Types.ObjectId(superAdminId)
    });
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy admin hoặc bạn không có quyền truy cập'
      });
    }
    
    // Lấy danh sách stores và populate employee info
    const stores = await Store.find({ adminId: new mongoose.Types.ObjectId(adminId) })
      .populate({
        path: 'employees',
        select: 'username name email isActive allowChangePassword'
      });
    
    const storesWithEmployees = stores.map(store => {
      const employee = store.employees[0]; // Giả định mỗi store có 1 employee chính
      return {
        id: store._id,
        name: store.name,
        address: store.address,
        phone: store.phone,
        isActive: store.isActive,
        employeeName: employee?.name || 'Chưa có nhân viên',
        employeeUsername: employee?.username || '',
        employeeId: employee?._id || null,
        allowChangePassword: employee?.allowChangePassword ?? true,
        createdAt: store.createdAt,
        updatedAt: store.updatedAt
      };
    });
    
    res.json({
      success: true,
      stores: storesWithEmployees
    });
    
  } catch (error) {
    console.error('Lỗi lấy danh sách cửa hàng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách cửa hàng'
    });
  }
};

// Tạo store mới với employee
const createStore = async (req, res) => {
  try {
    const superAdminId = req.user.id;
    const { 
      adminId, 
      username, 
      password, 
      employeeName, 
      storeName, 
      storeAddress, 
      storePhone, 
      isActive,
      allowChangePassword
    } = req.body;
    
    // Validate input
    if (!adminId || !username || !password || !employeeName || !storeName) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin: adminId, username, password, employeeName, storeName'
      });
    }
    
    // Kiểm tra admin có thuộc về superadmin này không
    const admin = await User.findOne({
      _id: new mongoose.Types.ObjectId(adminId),
      role: 'admin',
      parentId: new mongoose.Types.ObjectId(superAdminId)
    });
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy admin hoặc bạn không có quyền'
      });
    }
    
    // Kiểm tra username employee đã tồn tại chưa
    const existingEmployee = await User.findOne({ username });
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'Username nhân viên đã tồn tại'
      });
    }
    
    // Tạo store trước
    const newStore = new Store({
      name: storeName,
      address: storeAddress || '',
      phone: storePhone || '',
      adminId: new mongoose.Types.ObjectId(adminId),
      isActive: isActive !== undefined ? isActive : true
    });
    
    await newStore.save();
    
    // Tạo employee
    const newEmployee = new User({
      username,
      password, // Sẽ được hash tự động trong pre('save') hook
      name: employeeName,
      role: 'employee',
      parentId: new mongoose.Types.ObjectId(adminId),
      storeId: newStore._id,
      storeName: newStore.name,
      isActive: isActive !== undefined ? isActive : true,
      allowChangePassword: allowChangePassword !== undefined ? !!allowChangePassword : true,
      createdBy: new mongoose.Types.ObjectId(superAdminId)
    });
    
    await newEmployee.save();
    
    // Thêm employee vào store
    newStore.employees.push(newEmployee._id);
    await newStore.save();
    
    // Khởi tạo hệ số thưởng cho store mới
    console.log(`🎯 Khởi tạo hệ số thưởng cho store mới: ${newStore.name}`);
    try {
      await initializeDefaultMultipliers();
      console.log(`✅ Đã khởi tạo hệ số thưởng cho store ${newStore.name}`);
    } catch (multiplierError) {
      console.error(`⚠️  Lỗi khởi tạo hệ số thưởng cho store ${newStore.name}:`, multiplierError);
      // Không throw error để không làm fail việc tạo store
    }
    
    // Khởi tạo hệ số lô cho store mới
    console.log(`🎯 Khởi tạo hệ số lô cho store mới: ${newStore.name}`);
    try {
      await initializeLotoMultiplier(newStore._id);
      console.log(`✅ Đã khởi tạo hệ số lô cho store ${newStore.name}`);
    } catch (lotoMultiplierError) {
      console.error(`⚠️  Lỗi khởi tạo hệ số lô cho store ${newStore.name}:`, lotoMultiplierError);
      // Không throw error để không làm fail việc tạo store
    }
    
    res.json({
      success: true,
      message: 'Tạo cửa hàng và nhân viên thành công',
      store: {
        id: newStore._id,
        name: newStore.name,
        address: newStore.address,
        phone: newStore.phone,
        isActive: newStore.isActive,
        employeeName: newEmployee.name,
        employeeUsername: newEmployee.username
      }
    });
    
  } catch (error) {
    console.error('Lỗi tạo cửa hàng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo cửa hàng'
    });
  }
};

// Cập nhật store
const updateStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const superAdminId = req.user.id;
    const { employeeName, storeName, storeAddress, storePhone, password, isActive, allowChangePassword } = req.body;
    
    // Validate input
    if (!employeeName || !storeName) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin: employeeName, storeName'
      });
    }
    
    // Tìm store và kiểm tra quyền
    const store = await Store.findById(storeId).populate('adminId');
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cửa hàng'
      });
    }
    
    // Kiểm tra admin có thuộc về superadmin này không
    if (!store.adminId.parentId.equals(superAdminId)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật cửa hàng này'
      });
    }
    
    // Cập nhật store
    store.name = storeName;
    store.address = storeAddress || '';
    store.phone = storePhone || '';
    if (isActive !== undefined) store.isActive = isActive;
    await store.save();
    
    // Cập nhật employee (nhân viên đầu tiên trong danh sách)
    if (store.employees.length > 0) {
      const employee = await User.findById(store.employees[0]);
      if (employee) {
        employee.name = employeeName;
        employee.storeName = storeName;
        if (password) employee.password = password; // Sẽ được hash tự động
        if (isActive !== undefined) employee.isActive = isActive;
        if (allowChangePassword !== undefined) employee.allowChangePassword = !!allowChangePassword;
        await employee.save();
      }
    }
    
    res.json({
      success: true,
      message: 'Cập nhật cửa hàng thành công'
    });
    
  } catch (error) {
    console.error('Lỗi cập nhật cửa hàng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật cửa hàng'
    });
  }
};

// Xóa store
const deleteStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const superAdminId = req.user.id;
    
    // Tìm store và kiểm tra quyền
    const store = await Store.findById(storeId).populate('adminId');
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cửa hàng'
      });
    }
    
    // Kiểm tra admin có thuộc về superadmin này không
    if (!store.adminId.parentId.equals(superAdminId)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa cửa hàng này'
      });
    }
    
    // Xóa tất cả employees trong store
    await User.deleteMany({ _id: { $in: store.employees } });

    // Xóa hóa đơn cược và thưởng thuộc store
    const Invoice = require('../models/Invoice');
    const WinningInvoice = require('../models/WinningInvoice');
    await Invoice.deleteMany({ storeId: store._id });
    await WinningInvoice.deleteMany({ storeId: store._id });

    // Xóa hệ số thưởng và hệ số lô của store
    const PrizeMultiplier = require('../models/PrizeMultiplier');
    const LotoMultiplier = require('../models/LotoMultiplier');
    await PrizeMultiplier.deleteMany({ storeId: store._id });
    await LotoMultiplier.deleteMany({ storeId: store._id });
    
    // Xóa store
    await Store.deleteOne({ _id: storeId });
    
    res.json({
      success: true,
      message: 'Xóa cửa hàng và nhân viên thành công'
    });
    
  } catch (error) {
    console.error('Lỗi xóa cửa hàng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa cửa hàng'
    });
  }
};

module.exports = {
  getStoresByAdmin,
  createStore,
  updateStore,
  deleteStore
};