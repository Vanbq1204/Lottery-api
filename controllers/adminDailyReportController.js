const Store = require('../models/Store');
const DailyReport = require('../models/DailyReport');
const Invoice = require('../models/Invoice');
const WinningInvoice = require('../models/WinningInvoice');
const { getVietnamDayRange } = require('../utils/dateUtils');

const getAdminDailyReports = async (req, res) => {
  try {
    const { date } = req.query;
    const adminId = req.user && req.user.id;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Thiếu ngày' });
    }
    if (!adminId) {
      return res.status(403).json({ success: false, message: 'Yêu cầu quyền admin' });
    }

    const { startOfDay, endOfDay } = getVietnamDayRange(date);

    const stores = await Store.find({ adminId: adminId, isActive: true }).select('_id name');

    const results = [];
    for (const store of stores) {
      const savedReport = await DailyReport.findOne({ storeId: store._id, date: date });

      const invoices = await Invoice.find({
        storeId: store._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }).select('totalAmount');
      const currentRevenue = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

      const winningInvoices = await WinningInvoice.find({
        storeId: store._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }).select('totalPrizeAmount');
      const currentPayout = winningInvoices.reduce((sum, inv) => sum + (inv.totalPrizeAmount || 0), 0);

      const totalExpenses = (savedReport?.expenses || []).reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

      results.push({
        storeId: String(store._id),
        storeName: store.name,
        report: savedReport || null,
        currentRevenue,
        currentPayout,
        totalExpenses,
      });
    }

    return res.json({ success: true, data: { date, stores: results } });
  } catch (error) {
    console.error('Get admin daily reports error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = { getAdminDailyReports };
