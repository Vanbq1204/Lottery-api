const Invoice = require('../models/Invoice');
const User = require('../models/User');
const mongoose = require('mongoose');

// Helper: Vietnam date range
const getVietnamDayRange = (date) => {
  const start = new Date(date + 'T00:00:00.000Z');
  const end = new Date(date + 'T23:59:59.999Z');
  start.setHours(start.getHours() - 7);
  end.setHours(end.getHours() - 7);
  return { start, end };
};

// GET /api/superadmin/system-statistics?date=YYYY-MM-DD
const getSystemStatistics = async (req, res) => {
  try {
    const superAdminId = req.user.id;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ngày thống kê' });
    }

    const { start, end } = getVietnamDayRange(date);

    // Lấy tất cả admin thuộc superadmin này
    const admins = await User.find({ role: 'admin', parentId: new mongoose.Types.ObjectId(superAdminId) })
      .select('_id name username');

    const results = [];

    for (const admin of admins) {
      const invoices = await Invoice.find({
        adminId: admin._id,
        printedAt: { $gte: start, $lte: end }
      });

      const totals = {
        totalRevenue: 0,
        lotoTotal: 0,
        '2sTotal': 0,
        '3sTotal': 0,
        '4sTotal': 0,
        tongTotal: 0,
        kepTotal: 0,
        dauTotal: 0,
        ditTotal: 0,
        boTotal: 0,
        xienTotal: 0,
        xienquayTotal: 0
      };

      invoices.forEach(inv => {
        (inv.items || []).forEach(item => {
          const betType = (item.betType || '').toLowerCase();
          const betAmount = parseInt(item.totalAmount || 0) || 0; // tổng tiền khách trả cho item
          totals.totalRevenue += betAmount;

          if (betType === 'loto') totals.lotoTotal += betAmount;
          else if (betType === '2s') totals['2sTotal'] += betAmount;
          else if (betType === '3s') totals['3sTotal'] += betAmount;
          else if (betType === '4s') totals['4sTotal'] += betAmount;
          else if (betType === 'tong') totals.tongTotal += betAmount;
          else if (betType === 'kep') totals.kepTotal += betAmount;
          else if (betType === 'dau') totals.dauTotal += betAmount;
          else if (betType === 'dit') totals.ditTotal += betAmount;
          else if (betType === 'bo') totals.boTotal += betAmount;
          else if (betType.startsWith('xien') && !betType.includes('quay')) totals.xienTotal += betAmount;
          else if (betType.startsWith('xienquay')) totals.xienquayTotal += betAmount;
        });
      });

      results.push({
        adminId: admin._id,
        adminName: admin.name || admin.username,
        ...totals
      });
    }

    res.json({ success: true, date, admins: results });
  } catch (error) {
    console.error('System statistics error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi thống kê hệ thống' });
  }
};

module.exports = { getSystemStatistics };