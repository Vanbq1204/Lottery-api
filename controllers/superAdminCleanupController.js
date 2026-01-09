const Invoice = require('../models/Invoice');
const WinningInvoice = require('../models/WinningInvoice');
const Store = require('../models/Store');
const User = require('../models/User');
const InvoiceHistory = require('../models/InvoiceHistory');
const mongoose = require('mongoose');
const MessageExportSnapshot = require('../models/MessageExportSnapshot');
const DailyReport = require('../models/DailyReport');
const { getVietnamDayRange } = require('../utils/dateUtils');

// Helper: get Vietnam current date (YYYY-MM-DD)
const getCurrentVietnamDateStr = () => {
  const now = new Date();
  const vn = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const y = vn.getFullYear();
  const m = String(vn.getMonth() + 1).padStart(2, '0');
  const d = String(vn.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Retention rule: KEEP only today and yesterday; other days can be deleted
const isDateDeletable = (dateStr) => {
  const todayVN = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const y = todayVN.getFullYear();
  const m = String(todayVN.getMonth() + 1).padStart(2, '0');
  const d = String(todayVN.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const yesterdayVN = new Date(todayVN);
  yesterdayVN.setDate(todayVN.getDate() - 1);
  const yy = yesterdayVN.getFullYear();
  const ym = String(yesterdayVN.getMonth() + 1).padStart(2, '0');
  const yd = String(yesterdayVN.getDate()).padStart(2, '0');
  const yesterdayStr = `${yy}-${ym}-${yd}`;
  // Not deletable if selecting today or yesterday
  return (dateStr !== todayStr && dateStr !== yesterdayStr);
};

// GET /api/superadmin/cleanup/stats?date=YYYY-MM-DD&allowRecentDates=true/false
const getSuperAdminCleanupStats = async (req, res) => {
  try {
    const { date, allowRecentDates } = req.query;
    const superAdminId = req.user.id;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số date' });
    }

    // Validate retention rule - bypass if allowRecentDates is true
    const allowRecent = allowRecentDates === 'true';
    if (!allowRecent && !isDateDeletable(date)) {
      return res.status(400).json({ success: false, message: 'Không thể xóa dữ liệu của 2 ngày gần nhất (hôm nay và hôm qua)' });
    }

    const { startOfDay, endOfDay } = getVietnamDayRange(date);

    // Lấy tất cả admin của superadmin này
    const admins = await User.find({
      role: 'admin',
      parentId: new mongoose.Types.ObjectId(superAdminId)
    }).select('_id name username');

    const result = [];

    for (const admin of admins) {
      // Lấy stores của admin này
      const stores = await Store.find({ adminId: admin._id }).select('_id name');

      // Đếm số lượng bản ghi xuất tin nhắn của admin trong ngày này
      const totalSnapshots = await MessageExportSnapshot.countDocuments({
        adminId: admin._id,
        date
      });

      const adminData = {
        adminId: admin._id,
        adminName: admin.name || admin.username,
        totalSnapshots,
        totalDailyReports: 0,
        stores: []
      };

      for (const store of stores) {
        // Đếm tổng số hóa đơn trúng thưởng
        const totalWinningInvoices = await WinningInvoice.countDocuments({
          storeId: store._id,
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        // Đếm số hóa đơn trúng thưởng ĐÃ TRẢ
        const paidWinningInvoices = await WinningInvoice.countDocuments({
          storeId: store._id,
          isPaid: true,
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        const hasDailyReport = await DailyReport.countDocuments({ storeId: store._id, date });

        // Đếm số lượng lịch sử sửa đổi hóa đơn
        const totalInvoiceHistory = await InvoiceHistory.countDocuments({
          storeId: store._id,
          actionDate: { $gte: startOfDay, $lte: endOfDay }
        });

        adminData.totalDailyReports += hasDailyReport > 0 ? 1 : 0;
        adminData.stores.push({
          storeId: store._id,
          storeName: store.name,
          totalWinningInvoices,
          paidWinningInvoices,
          hasDailyReport: hasDailyReport > 0,
          totalInvoiceHistory
        });
      }

      result.push(adminData);
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('SuperAdmin cleanup stats error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy thống kê dữ liệu' });
  }
};

// DELETE /api/superadmin/cleanup
// Body: { date: 'YYYY-MM-DD', stores: [{ storeId: 'id1', keepWinningInvoices: true }, ...], allowRecentDates: boolean }
const performSuperAdminCleanup = async (req, res) => {
  try {
    const { date, stores, allowRecentDates = false } = req.body;
    const superAdminId = req.user.id;

    if (!date || !stores || !Array.isArray(stores) || stores.length === 0) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số date hoặc danh sách stores' });
    }

    // Validate retention rule - bypass if allowRecentDates is true
    if (!allowRecentDates && !isDateDeletable(date)) {
      return res.status(400).json({ success: false, message: 'Không thể xóa dữ liệu của 2 ngày gần nhất (hôm nay và hôm qua)' });
    }

    const { startOfDay, endOfDay } = getVietnamDayRange(date);

    // Phân loại stores theo keepWinningInvoices
    const storesKeepWinning = stores.filter(s => s.keepWinningInvoices === true).map(s => s.storeId);
    const storesDeleteAll = stores.filter(s => s.keepWinningInvoices !== true).map(s => s.storeId);
    const allStoreIds = stores.map(s => s.storeId);

    // Xóa hóa đơn cược cho TẤT CẢ các stores
    const deletedInvoicesResult = await Invoice.deleteMany({
      storeId: { $in: allStoreIds },
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    // Xóa hoá đơn thưởng CHỈ cho các stores có keepWinningInvoices = false
    let deletedWinningInvoicesResult = { deletedCount: 0 };
    let keptWinningInvoices = 0;

    if (storesDeleteAll.length > 0) {
      deletedWinningInvoicesResult = await WinningInvoice.deleteMany({
        storeId: { $in: storesDeleteAll },
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      });
    }

    // Đếm số lượng hoá đơn thưởng được giữ lại
    if (storesKeepWinning.length > 0) {
      keptWinningInvoices = await WinningInvoice.countDocuments({
        storeId: { $in: storesKeepWinning },
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      });
    }

    // Xóa MessageExportSnapshot cho các admin liên quan đến các store được chọn
    const storeDocuments = await Store.find({ _id: { $in: allStoreIds } }).select('adminId');
    const adminIds = [...new Set(storeDocuments.map(s => s.adminId.toString()))];

    const deletedSnapshotsResult = await MessageExportSnapshot.deleteMany({
      adminId: { $in: adminIds },
      date
    });

    const deletedDailyReportsResult = await DailyReport.deleteMany({
      storeId: { $in: allStoreIds },
      date
    });

    // Xóa lịch sử sửa đổi hóa đơn
    const deletedInvoiceHistoryResult = await InvoiceHistory.deleteMany({
      storeId: { $in: allStoreIds },
      actionDate: { $gte: startOfDay, $lte: endOfDay }
    });

    return res.json({
      success: true,
      message: 'Xóa dữ liệu thành công',
      deletedInvoices: deletedInvoicesResult.deletedCount,
      deletedWinningInvoices: deletedWinningInvoicesResult.deletedCount,
      keptWinningInvoices: keptWinningInvoices,
      deletedSnapshots: deletedSnapshotsResult.deletedCount,
      deletedDailyReports: deletedDailyReportsResult.deletedCount,
      deletedInvoiceHistory: deletedInvoiceHistoryResult.deletedCount
    });
  } catch (error) {
    console.error('SuperAdmin perform cleanup error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi xóa dữ liệu' });
  }
};

module.exports = { getSuperAdminCleanupStats, performSuperAdminCleanup };
