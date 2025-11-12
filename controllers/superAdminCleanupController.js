const Invoice = require('../models/Invoice');
const WinningInvoice = require('../models/WinningInvoice');
const Store = require('../models/Store');
const User = require('../models/User');
const mongoose = require('mongoose');
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

// GET /api/superadmin/cleanup/stats?adminId=...&date=YYYY-MM-DD
const getSuperAdminCleanupStats = async (req, res) => {
  try {
    const { adminId, date } = req.query;

    if (!adminId || !date) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số adminId hoặc date' });
    }

    const admin = await User.findOne({ _id: new mongoose.Types.ObjectId(adminId), role: 'admin' });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy admin' });
    }

    // Validate retention rule
    if (!isDateDeletable(date)) {
      return res.status(400).json({ success: false, message: 'Không thể xóa dữ liệu của 2 ngày gần nhất (hôm nay và hôm qua)' });
    }

    const { startOfDay, endOfDay } = getVietnamDayRange(date);

    const stores = await Store.find({ adminId: admin._id }).select('_id');
    const storeIds = stores.map(s => s._id);

    if (storeIds.length === 0) {
      return res.json({ success: true, stats: { totalInvoices: 0, totalWinningInvoices: 0, affectedStores: 0 } });
    }

    const totalInvoices = await Invoice.countDocuments({ storeId: { $in: storeIds }, createdAt: { $gte: startOfDay, $lte: endOfDay } });
    const totalWinningInvoices = await WinningInvoice.countDocuments({ storeId: { $in: storeIds }, createdAt: { $gte: startOfDay, $lte: endOfDay } });
    const totalSnapshots = await require('../models/MessageExportSnapshot').countDocuments({ adminId: admin._id, date });

    const affectedStoresInvoices = await Invoice.distinct('storeId', { storeId: { $in: storeIds }, createdAt: { $gte: startOfDay, $lte: endOfDay } });
    const affectedStoresWinning = await WinningInvoice.distinct('storeId', { storeId: { $in: storeIds }, createdAt: { $gte: startOfDay, $lte: endOfDay } });
    const affectedStores = new Set([...affectedStoresInvoices, ...affectedStoresWinning]).size;

    return res.json({ success: true, stats: { totalInvoices, totalWinningInvoices, totalSnapshots, affectedStores } });
  } catch (error) {
    console.error('SuperAdmin cleanup stats error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy thống kê dữ liệu' });
  }
};

// DELETE /api/superadmin/cleanup?adminId=...&date=YYYY-MM-DD
const performSuperAdminCleanup = async (req, res) => {
  try {
    const { adminId, date } = req.query;

    if (!adminId || !date) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số adminId hoặc date' });
    }

    const admin = await User.findOne({ _id: new mongoose.Types.ObjectId(adminId), role: 'admin' });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy admin' });
    }

    // Validate retention rule
    if (!isDateDeletable(date)) {
      return res.status(400).json({ success: false, message: 'Không thể xóa dữ liệu của 2 ngày gần nhất (hôm nay và hôm qua)' });
    }

    const { startOfDay, endOfDay } = getVietnamDayRange(date);
    const stores = await Store.find({ adminId: admin._id }).select('_id');
    const storeIds = stores.map(s => s._id);

    if (storeIds.length === 0) {
      return res.json({ success: true, message: 'Không có cửa hàng nào thuộc admin này', deletedInvoices: 0, deletedWinningInvoices: 0 });
    }

    const deletedInvoicesResult = await Invoice.deleteMany({ storeId: { $in: storeIds }, createdAt: { $gte: startOfDay, $lte: endOfDay } });
    const deletedWinningInvoicesResult = await WinningInvoice.deleteMany({ storeId: { $in: storeIds }, createdAt: { $gte: startOfDay, $lte: endOfDay } });
    const deletedSnapshotsResult = await require('../models/MessageExportSnapshot').deleteMany({ adminId: admin._id, date });

    return res.json({ success: true, message: 'Xóa dữ liệu thành công', deletedInvoices: deletedInvoicesResult.deletedCount, deletedWinningInvoices: deletedWinningInvoicesResult.deletedCount, deletedSnapshots: deletedSnapshotsResult.deletedCount });
  } catch (error) {
    console.error('SuperAdmin perform cleanup error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi xóa dữ liệu' });
  }
};

module.exports = { getSuperAdminCleanupStats, performSuperAdminCleanup };