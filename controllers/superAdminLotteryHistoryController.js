const LotteryResultHistory = require('../models/LotteryResultHistory');

// GET /api/superadmin/system-history/lottery?date=YYYY-MM-DD&startDate=&endDate=&storeId=&adminId=
const getLotteryHistory = async (req, res) => {
  try {
    const superAdminId = req.user.id;
    // superAdmin check is handled by route middleware
    const { date, startDate, endDate, storeId, adminId, limit = 100 } = req.query;

    const query = {};
    if (date) {
      const [year, month, day] = date.split('-');
      query.turnNum = `${day}/${month}/${year}`; // dd/MM/YYYY
    }
    if (storeId) query.storeId = storeId;
    if (adminId) query.adminId = adminId;

    // Time range filter using changedAt
    if (startDate || endDate) {
      query.changedAt = {};
      if (startDate) query.changedAt.$gte = new Date(startDate);
      if (endDate) query.changedAt.$lte = new Date(endDate);
    }

    const items = await LotteryResultHistory.find(query)
      .sort({ changedAt: -1 })
      .limit(Math.min(parseInt(limit) || 100, 500));

    return res.json({ success: true, history: items });
  } catch (error) {
    console.error('Get lottery history error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch sử kết quả xổ số' });
  }
};

module.exports = { getLotteryHistory };

// DELETE /api/superadmin/system-history/lottery?date=YYYY-MM-DD
module.exports.deleteLotteryHistoryByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số date (YYYY-MM-DD)' });
    }
    const [year, month, day] = date.split('-');
    const turnNum = `${day}/${month}/${year}`; // dd/MM/YYYY

    const result = await LotteryResultHistory.deleteMany({ turnNum });
    return res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error('Delete lottery history error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi xóa lịch sử kết quả xổ số' });
  }
};