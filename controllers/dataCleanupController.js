const Invoice = require('../models/Invoice');
const WinningInvoice = require('../models/WinningInvoice');
const Store = require('../models/Store');
const { getVietnamDayRange } = require('../utils/dateUtils');

// Lấy thống kê dữ liệu sẽ bị xóa
const getCleanupStats = async (req, res) => {
  try {
    const { beforeDate } = req.query;
    const adminId = req.user.id;

    if (!beforeDate) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu tham số beforeDate'
      });
    }

    // Lấy danh sách cửa hàng của admin
    const stores = await Store.find({ adminId: adminId });
    const storeIds = stores.map(store => store._id);

    if (storeIds.length === 0) {
      return res.json({
        success: true,
        stats: {
          totalInvoices: 0,
          totalWinningInvoices: 0,
          affectedStores: 0
        }
      });
    }

    // Tạo range ngày để xóa (trước beforeDate)
    const endDate = new Date(beforeDate);
    endDate.setHours(23, 59, 59, 999);

    // Đếm số hóa đơn cược sẽ bị xóa
    const totalInvoices = await Invoice.countDocuments({
      storeId: { $in: storeIds },
      createdAt: { $lt: endDate }
    });

    // Đếm số hóa đơn thưởng sẽ bị xóa
    const totalWinningInvoices = await WinningInvoice.countDocuments({
      storeId: { $in: storeIds },
      createdAt: { $lt: endDate }
    });

    // Đếm số cửa hàng bị ảnh hưởng
    const affectedStoresInvoices = await Invoice.distinct('storeId', {
      storeId: { $in: storeIds },
      createdAt: { $lt: endDate }
    });

    const affectedStoresWinning = await WinningInvoice.distinct('storeId', {
      storeId: { $in: storeIds },
      createdAt: { $lt: endDate }
    });

    const uniqueAffectedStores = new Set([...affectedStoresInvoices, ...affectedStoresWinning]);

    res.json({
      success: true,
      stats: {
        totalInvoices,
        totalWinningInvoices,
        affectedStores: uniqueAffectedStores.size
      }
    });

  } catch (error) {
    console.error('❌ Error getting cleanup stats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê dữ liệu'
    });
  }
};

// Thực hiện xóa dữ liệu
const performCleanup = async (req, res) => {
  try {
    const { beforeDate } = req.query;
    const adminId = req.user.id;

    if (!beforeDate) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu tham số beforeDate'
      });
    }

    // Lấy danh sách cửa hàng của admin
    const stores = await Store.find({ adminId: adminId });
    const storeIds = stores.map(store => store._id);

    if (storeIds.length === 0) {
      return res.json({
        success: true,
        message: 'Không có cửa hàng nào để xóa dữ liệu',
        deletedInvoices: 0,
        deletedWinningInvoices: 0
      });
    }

    // Tạo range ngày để xóa (trước beforeDate)
    const endDate = new Date(beforeDate);
    endDate.setHours(23, 59, 59, 999);

    console.log(`🗑️ Admin ${adminId} đang xóa dữ liệu trước ngày: ${endDate}`);
    console.log(`📍 Cửa hàng bị ảnh hưởng: ${storeIds.length} cửa hàng`);

    // Xóa hóa đơn cược
    const deletedInvoicesResult = await Invoice.deleteMany({
      storeId: { $in: storeIds },
      createdAt: { $lt: endDate }
    });

    // Xóa hóa đơn thưởng
    const deletedWinningInvoicesResult = await WinningInvoice.deleteMany({
      storeId: { $in: storeIds },
      createdAt: { $lt: endDate }
    });

    console.log(`✅ Đã xóa ${deletedInvoicesResult.deletedCount} hóa đơn cược`);
    console.log(`✅ Đã xóa ${deletedWinningInvoicesResult.deletedCount} hóa đơn thưởng`);

    res.json({
      success: true,
      message: 'Xóa dữ liệu thành công',
      deletedInvoices: deletedInvoicesResult.deletedCount,
      deletedWinningInvoices: deletedWinningInvoicesResult.deletedCount
    });

  } catch (error) {
    console.error('❌ Error performing cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa dữ liệu'
    });
  }
};

module.exports = {
  getCleanupStats,
  performCleanup
};