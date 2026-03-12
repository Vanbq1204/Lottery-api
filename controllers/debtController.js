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
                // Tính toán còn lại của ngày hôm qua
                // Công thức cũ: remaining = oldDebt + paid - received (nhưng oldDebt đã bao gồm số mới)
                // Công thức mới: remaining = todayAmount + paid - received (todayAmount là tổng nợ hôm nay)
                // Tuy nhiên, logic cũ lưu oldDebt = old + new, nên remaining tính theo oldDebt là đúng với dữ liệu cũ.
                // Để chuyển đổi mượt mà, ta cần xem xét dữ liệu hiện tại.
                // Giả sử logic cũ đang chạy: oldDebt chứa tổng.
                // Vậy remaining = oldDebt + paid - received.
                
                const remaining = (record.oldDebt || 0) + (record.paid || 0) - (record.received || 0);
                
                record.oldDebt = remaining;
                record.todayAmount = remaining; // Hôm nay bắt đầu bằng Nợ cũ
                record.paid = 0;
                record.received = 0;
                record.hasAddedToday = false;
                record.lastUpdatedDate = currentDate;
                await record.save();
            }
        }

        const remaining = (record.todayAmount || 0) + (record.paid || 0) - (record.received || 0);

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
        const { oldDebt, paid, received, todayAmount } = req.body;

        let record = await AdminDebt.findOne({ adminId });
        if (!record) {
            record = new AdminDebt({ adminId, lastUpdatedDate: getCurrentVNDate() });
        }

        if (oldDebt !== undefined) record.oldDebt = Number(oldDebt);
        if (paid !== undefined) record.paid = Number(paid);
        if (received !== undefined) record.received = Number(received);
        if (todayAmount !== undefined) record.todayAmount = Number(todayAmount);

        await record.save();

        const remaining = (record.todayAmount || 0) + (record.paid || 0) - (record.received || 0);

        res.json({
            success: true,
            message: 'Cập nhật thành công',
            data: {
                id: record._id,
                oldDebt: record.oldDebt,
                paid: record.paid,
                received: record.received,
                todayAmount: record.todayAmount,
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
            // Tính toán remaining ngày cũ
            // Nếu record cũ chạy theo logic cũ (oldDebt chứa tổng), thì remaining = oldDebt + paid - received
            // Nếu record cũ chạy theo logic mới (todayAmount chứa tổng), thì remaining = todayAmount + paid - received
            // Để an toàn, ta giả định todayAmount luôn được cập nhật đúng. 
            // Nhưng nếu todayAmount = 0 (logic cũ reset), thì ta dựa vào oldDebt.
            // Tuy nhiên, logic addDebt cũ cập nhật cả oldDebt và todayAmount.
            
            // Ta sẽ ưu tiên dùng todayAmount nếu nó > 0 hoặc hasAddedToday = true.
            // Nhưng logic cũ reset todayAmount = 0 khi sang ngày mới.
            // Nên khi sang ngày mới ở đây, ta lấy oldDebt (đã được update cuối ngày hôm trước? Không, getDebt update).
            // Nếu getDebt chưa chạy, thì record vẫn là của ngày hôm qua.
            
            // Logic cũ: oldDebt chứa tổng.
            const remaining = (record.oldDebt || 0) + (record.paid || 0) - (record.received || 0);
            
            record.oldDebt = remaining;
            record.todayAmount = remaining; // Reset today = old
            record.paid = 0;
            record.received = 0;
            record.hasAddedToday = false;
            record.lastUpdatedDate = currentDate;
        }

        if (record.hasAddedToday) {
            const remaining = (record.todayAmount || 0) + (record.paid || 0) - (record.received || 0);
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

        // Logic MỚI: Không cộng vào oldDebt nữa. Chỉ cộng vào todayAmount.
        // todayAmount = oldDebt + newAmount
        // (Lưu ý: todayAmount đã được khởi tạo bằng oldDebt ở trên hoặc ở getDebt)
        // Nếu todayAmount chưa được khởi tạo (trường hợp record mới tinh trong ngày), nó nên là oldDebt.
        if (record.todayAmount === undefined || record.todayAmount === null) {
             record.todayAmount = record.oldDebt || 0;
        }
        
        record.todayAmount = (record.oldDebt || 0) + Number(newAmount);
        
        // record.oldDebt không đổi
        
        record.hasAddedToday = true;
        await record.save();

        const remaining = (record.todayAmount || 0) + (record.paid || 0) - (record.received || 0);

        res.json({
            success: true,
            message: 'Đã lưu vào Sổ nợ',
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
            record.hasAddedToday = false;
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
