const DebtRecord = require('../models/DebtRecord');

// Lấy danh sách nợ của admin
const getDebts = async (req, res) => {
    try {
        const adminId = req.user.id;
        const records = await DebtRecord.find({ adminId }).sort({ date: -1 });

        res.json({
            success: true,
            data: records.map(r => ({
                id: r._id,
                date: r.date,
                debtAmount: r.debtAmount,
                paidAmount: r.paidAmount,
                remainingDebt: r.debtAmount + r.paidAmount // "nợ còn -20000" (nếu ghi -20500 và trả 500)
            }))
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách nợ:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Cập nhật nợ hoặc tiền trả cho một ngày
const updateDebt = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { date, debtAmount, paidAmount } = req.body;

        if (!date) {
            return res.status(400).json({ success: false, message: 'Ngày không hợp lệ' });
        }

        let record = await DebtRecord.findOne({ adminId, date });
        if (!record) {
            record = new DebtRecord({ adminId, date });
        }

        // Upsert debtAmount hoặc paidAmount nếu có
        if (debtAmount !== undefined) record.debtAmount = debtAmount;
        if (paidAmount !== undefined) record.paidAmount = paidAmount;

        await record.save();

        res.json({
            success: true,
            message: 'Cập nhật thành công',
            data: {
                id: record._id,
                date: record.date,
                debtAmount: record.debtAmount,
                paidAmount: record.paidAmount,
                remainingDebt: record.debtAmount + record.paidAmount
            }
        });
    } catch (error) {
        console.error('Lỗi cập nhật nợ:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Xoá ghi nợ của ngày
const deleteDebt = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { date } = req.params;

        await DebtRecord.deleteOne({ adminId, date });

        res.json({ success: true, message: 'Đã xoá ghi nợ' });
    } catch (error) {
        console.error('Lỗi xoá nợ:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = {
    getDebts,
    updateDebt,
    deleteDebt
};
