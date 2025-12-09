const DailyReport = require('../models/DailyReport');
const Invoice = require('../models/Invoice');
const WinningInvoice = require('../models/WinningInvoice');
const { getVietnamDayRange } = require('../utils/dateUtils');

const getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const user = req.user;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Thiếu ngày' });
    }

    const { startOfDay, endOfDay } = getVietnamDayRange(date);

    // 1. Calculate Revenue (Total from Invoices)
    const invoices = await Invoice.find({
      storeId: user.storeId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });
    const currentRevenue = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    // 2. Calculate Payout (Total from WinningInvoices)
    const winningInvoices = await WinningInvoice.find({
      storeId: user.storeId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });
    const currentPayout = winningInvoices.reduce((sum, inv) => sum + (inv.totalPrizeAmount || 0), 0);

    // 3. Get existing report if any
    const report = await DailyReport.findOne({
      storeId: user.storeId,
      date: date
    });

    res.json({
      success: true,
      data: {
        report: report || null,
        currentRevenue,
        currentPayout
      }
    });
  } catch (error) {
    console.error('Get daily report error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const saveDailyReport = async (req, res) => {
  try {
    const { date, expenses, totalRevenue, totalPayout } = req.body;
    const user = req.user;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Thiếu ngày' });
    }

    // Calculate net income
    const totalExpenses = (expenses || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const netIncome = totalRevenue - totalExpenses - totalPayout;

    const report = await DailyReport.findOneAndUpdate(
      { storeId: user.storeId, date: date },
      {
        storeId: user.storeId,
        date,
        expenses,
        totalRevenue,
        totalPayout,
        netIncome,
        createdBy: user.id
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: report, message: 'Lưu báo cáo thành công' });
  } catch (error) {
    console.error('Save daily report error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = { getDailyReport, saveDailyReport };
