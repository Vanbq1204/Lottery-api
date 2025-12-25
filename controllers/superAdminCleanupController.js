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

// GET /api/superadmin/cleanup/stats?date=YYYY-MM-DD
const getSuperAdminCleanupStats = async (req, res) => {
  try {
    const { date } = req.query;
    const superAdminId = req.user.id;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số date' });
    }

    // Validate retention rule
    if (!isDateDeletable(date)) {
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
// Body: { date: 'YYYY-MM-DD', storeIds: ['id1', 'id2'] }
const performSuperAdminCleanup = async (req, res) => {
  try {
    const { date, storeIds } = req.body; // Use body for array data
    const superAdminId = req.user.id;

    if (!date || !storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số date hoặc danh sách storeIds' });
    }

    // Validate retention rule
    if (!isDateDeletable(date)) {
      return res.status(400).json({ success: false, message: 'Không thể xóa dữ liệu của 2 ngày gần nhất (hôm nay và hôm qua)' });
    }

    const { startOfDay, endOfDay } = getVietnamDayRange(date);

    // Thực hiện xóa hàng loạt cho các store được chọn
    const deletedInvoicesResult = await Invoice.deleteMany({
      storeId: { $in: storeIds },
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    const deletedWinningInvoicesResult = await WinningInvoice.deleteMany({
      storeId: { $in: storeIds },
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    // Xóa MessageExportSnapshot cho các admin liên quan đến các store được chọn
    // 1. Tìm các adminId từ danh sách storeIds
    const stores = await Store.find({ _id: { $in: storeIds } }).select('adminId');
    const adminIds = [...new Set(stores.map(s => s.adminId.toString()))];

    // 2. Xóa snapshot của các admin này
    const deletedSnapshotsResult = await MessageExportSnapshot.deleteMany({
      adminId: { $in: adminIds },
      date
    });

    const deletedDailyReportsResult = await DailyReport.deleteMany({
      storeId: { $in: storeIds },
      date
    });

    // Xóa lịch sử sửa đổi hóa đơn
    const deletedInvoiceHistoryResult = await InvoiceHistory.deleteMany({
      storeId: { $in: storeIds },
      actionDate: { $gte: startOfDay, $lte: endOfDay }
    });

    return res.json({
      success: true,
      message: 'Xóa dữ liệu thành công',
      deletedInvoices: deletedInvoicesResult.deletedCount,
      deletedWinningInvoices: deletedWinningInvoicesResult.deletedCount,
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
