const AdminDebt = require('../models/AdminDebt');
const { getVietnamDayRange } = require('../utils/dateUtils'); // Dùng utils lấy ngày VN

// Helper lấy ngày hiện tại ở VN
const getCurrentVNDate = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
};

// Lấy thông tin sổ nợ hiện tại
const getDebt = async (req, res) => {
    try {
        const adminId = req.user.id;
        const currentDate = getCurrentVNDate();

        let record = await AdminDebt.findOne({ adminId });
        if (!record) {
            record = new AdminDebt({
                adminId,
                lastUpdatedDate: currentDate
            });
            await record.save();
        } else {
            // Logic sang ngày mới: Cộng tồn vào Nợ Cũ, Reset Trả/Nhận
            if (record.lastUpdatedDate !== currentDate) {
                const remaining = (record.oldDebt || 0) + (record.paid || 0) - (record.received || 0);
                record.oldDebt = remaining;
                record.paid = 0;
                record.received = 0;
                record.todayAmount = 0;
                record.hasAddedToday = false;
                record.lastUpdatedDate = currentDate;
                await record.save();
            }
        }

        const remaining = (record.oldDebt || 0) + (record.paid || 0) - (record.received || 0);

        res.json({
            success: true,
            data: {
                id: record._id,
                oldDebt: record.oldDebt,
                paid: record.paid,
                received: record.received,
                todayAmount: record.todayAmount || 0,
                remainingDebt: remaining,
                lastUpdatedDate: record.lastUpdatedDate,
                hasAddedToday: record.hasAddedToday
            }
        });
    } catch (error) {
        console.error('Lỗi lấy sổ nợ:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Cập nhật Sửa thông tin sổ nợ
const updateDebt = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { oldDebt, paid, received } = req.body;

        let record = await AdminDebt.findOne({ adminId });
        if (!record) {
            record = new AdminDebt({ adminId, lastUpdatedDate: getCurrentVNDate() });
        }

        if (oldDebt !== undefined) record.oldDebt = Number(oldDebt);
        if (paid !== undefined) record.paid = Number(paid);
        if (received !== undefined) record.received = Number(received);

        await record.save();

        const remaining = (record.oldDebt || 0) + (record.paid || 0) - (record.received || 0);

        res.json({
            success: true,
            message: 'Cập nhật thành công',
            data: {
                id: record._id,
                oldDebt: record.oldDebt,
                paid: record.paid,
                received: record.received,
                remainingDebt: remaining,
                lastUpdatedDate: record.lastUpdatedDate
            }
        });
    } catch (error) {
        console.error('Lỗi cập nhật nợ:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Thêm tiền vào cột nợ cũ (Khi bấm nút Lưu sổ nợ)
const addDebt = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { newAmount } = req.body; // Số tiền tổng kết ngày cần + vào nợ cũ

        let record = await AdminDebt.findOne({ adminId });
        if (!record) {
            record = new AdminDebt({ adminId, lastUpdatedDate: getCurrentVNDate() });
        }

        // Logic sang ngày mới trước khi add
        const currentDate = getCurrentVNDate();
        if (record.lastUpdatedDate !== currentDate) {
            record.oldDebt = (record.oldDebt || 0) + (record.paid || 0) - (record.received || 0);
            record.paid = 0;
            record.received = 0;
            record.todayAmount = 0;
            record.hasAddedToday = false;
            record.lastUpdatedDate = currentDate;
        }

        if (record.hasAddedToday) {
            const remaining = (record.oldDebt || 0) + (record.paid || 0) - (record.received || 0);
            return res.json({
                success: true,
                message: 'Đã cập nhật giá trị nợ này',
                data: {
                    id: record._id,
                    oldDebt: record.oldDebt,
                    paid: record.paid,
                    received: record.received,
                    todayAmount: record.todayAmount || 0,
                    remainingDebt: remaining,
                    lastUpdatedDate: record.lastUpdatedDate,
                    hasAddedToday: record.hasAddedToday
                }
            });
        }

        record.oldDebt = (record.oldDebt || 0) + Number(newAmount);
        record.todayAmount = Number(newAmount);
        record.hasAddedToday = true;
        await record.save();

        const remaining = (record.oldDebt || 0) + (record.paid || 0) - (record.received || 0);

        res.json({
            success: true,
            message: 'Đã lưu vào Nợ Cũ',
            data: {
                id: record._id,
                oldDebt: record.oldDebt,
                paid: record.paid,
                received: record.received,
                todayAmount: record.todayAmount,
                remainingDebt: remaining,
                lastUpdatedDate: record.lastUpdatedDate,
                hasAddedToday: record.hasAddedToday
            }
        });
    } catch (error) {
        console.error('Lỗi thêm nợ mới:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Xoá ghi nợ (reset về 0)
const deleteDebt = async (req, res) => {
    try {
        const adminId = req.user.id;

        let record = await AdminDebt.findOne({ adminId });
        if (record) {
            record.oldDebt = 0;
            record.paid = 0;
            record.received = 0;
            record.todayAmount = 0;
            await record.save();
        }

        res.json({ success: true, message: 'Đã xoá (reset) sổ nợ' });
    } catch (error) {
        console.error('Lỗi xoá nợ:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = {
    getDebt,
    updateDebt,
    addDebt,
    deleteDebt
};
