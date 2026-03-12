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
                // Logic trước đó: todayAmount = remaining (bao gồm cả oldDebt).
                // Nhưng theo yêu cầu mới: "Hôm nay" chỉ chứa phần phát sinh mới. "Nợ cũ" chứa phần còn lại hôm qua.
                // "Hôm nay" hôm qua (giá trị đã lưu) + "Nợ cũ" hôm qua + "Đã trả" - "Đã nhận".
                // Nhưng lưu ý: Logic addDebt trước đó có thể đã cộng dồn oldDebt vào todayAmount (ở phiên bản trước nữa).
                // Hoặc todayAmount = oldDebt + newAmount.
                
                // Để tính chính xác Remaining hôm qua:
                // remaining = todayAmount + paid - received (nếu todayAmount đã bao gồm oldDebt theo logic cũ).
                // Hoặc remaining = todayAmount + oldDebt + paid - received (theo logic mới hoàn toàn).
                
                // Chúng ta cần chuyển đổi an toàn.
                // Giả sử record đang ở trạng thái của ngày hôm qua.
                // Nếu chạy theo logic cũ: oldDebt chứa tổng nợ.
                // Nếu chạy theo logic vừa sửa: todayAmount chứa tổng nợ (bao gồm oldDebt).
                
                // Hãy tính remaining dựa trên logic hiện tại của record đó.
                // Cách an toàn nhất là lấy remaining hiện tại được tính toán trước đó.
                // Nhưng ta không lưu remaining trong DB.
                
                // Kiểm tra xem todayAmount có > 0 không.
                // Nếu todayAmount > 0, có thể nó chứa tổng nợ (theo logic vừa sửa) hoặc chỉ nợ mới (nếu chưa sửa xong).
                // Tuy nhiên, logic addDebt vừa rồi là: todayAmount = oldDebt + newAmount.
                // Vậy remaining = todayAmount + paid - received.
                
                // Nếu todayAmount = 0 (chưa addDebt hôm qua), thì remaining = oldDebt.
                
                // Tuy nhiên, logic mới yêu cầu:
                // Remaining hôm qua -> OldDebt hôm nay.
                // TodayAmount hôm nay -> 0.
                
                // Tính Remaining hôm qua:
                let previousRemaining = 0;
                // Nếu record theo logic cũ (oldDebt là tổng):
                previousRemaining = (record.oldDebt || 0) + (record.paid || 0) - (record.received || 0);
                
                // Nếu record đã có todayAmount (theo logic vừa sửa, todayAmount = old + new):
                // Thì remaining phải tính dựa trên todayAmount.
                // Nhưng cẩn thận: trong logic addDebt vừa rồi: record.todayAmount = (record.oldDebt || 0) + Number(newAmount);
                // Vậy todayAmount đã bao gồm oldDebt.
                // Khi đó remaining = todayAmount + paid - received.
                
                if (record.todayAmount && record.hasAddedToday) {
                     previousRemaining = record.todayAmount + (record.paid || 0) - (record.received || 0);
                }

                // Cập nhật cho ngày mới
                record.oldDebt = previousRemaining;
                record.todayAmount = 0; // Hôm nay về 0
                record.paid = 0;
                record.received = 0;
                record.hasAddedToday = false;
                record.lastUpdatedDate = currentDate;
                await record.save();
            }
        }

        // Logic hiển thị: Remaining = OldDebt + TodayAmount + Paid - Received
        const remaining = (record.oldDebt || 0) + (record.todayAmount || 0) + (record.paid || 0) - (record.received || 0);

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

        const remaining = (record.oldDebt || 0) + (record.todayAmount || 0) + (record.paid || 0) - (record.received || 0);

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
            // Logic tương tự getDebt
            let previousRemaining = (record.oldDebt || 0) + (record.paid || 0) - (record.received || 0);
             if (record.todayAmount && record.hasAddedToday) {
                 previousRemaining = record.todayAmount + (record.paid || 0) - (record.received || 0);
            }
            
            record.oldDebt = previousRemaining;
            record.todayAmount = 0;
            record.paid = 0;
            record.received = 0;
            record.hasAddedToday = false;
            record.lastUpdatedDate = currentDate;
        }

        if (record.hasAddedToday) {
            // Nếu đã add rồi, cập nhật lại todayAmount bằng newAmount (ghi đè)
            // User: "Khi bấm lưu vào sổ nợ thì hôm nay sẽ cập nhật = giá trị của giá trị đó"
            record.todayAmount = Number(newAmount);
            await record.save();

            const remaining = (record.oldDebt || 0) + (record.todayAmount || 0) + (record.paid || 0) - (record.received || 0);
            return res.json({
                success: true,
                message: 'Đã cập nhật giá trị hôm nay',
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

        // Logic MỚI: Chỉ cập nhật todayAmount = newAmount. Không cộng vào oldDebt.
        record.todayAmount = Number(newAmount);
        
        record.hasAddedToday = true;
        await record.save();

        const remaining = (record.oldDebt || 0) + (record.todayAmount || 0) + (record.paid || 0) - (record.received || 0);

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
