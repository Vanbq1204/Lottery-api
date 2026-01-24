const AutoCleanupSettings = require('../models/AutoCleanupSettings');
const User = require('../models/User');
const Store = require('../models/Store');
const Invoice = require('../models/Invoice');
const WinningInvoice = require('../models/WinningInvoice');
const DailyReport = require('../models/DailyReport');
const MessageExportSnapshot = require('../models/MessageExportSnapshot');
const InvoiceHistory = require('../models/InvoiceHistory');

// Lấy danh sách cài đặt auto cleanup của tất cả admins (cho SuperAdmin)
exports.getAllAutoCleanupSettings = async (req, res) => {
    try {
        // Lấy tất cả admins
        const admins = await User.find({ role: 'admin' }).select('username fullName');

        // Lấy tất cả settings
        const settings = await AutoCleanupSettings.find({});
        const settingsMap = new Map();
        settings.forEach(s => {
            if (s.adminId) {
                settingsMap.set(s.adminId.toString(), s);
            }
        });

        // Kết hợp dữ liệu
        const result = admins.map(admin => {
            const setting = settingsMap.get(admin._id.toString());
            return {
                adminId: admin._id,
                adminName: admin.fullName || admin.username,
                enabled: setting?.enabled || false,
                cleanupAfterHours: setting?.cleanupAfterHours || 24,
                keepUnpaidWinningInvoices: setting?.keepUnpaidWinningInvoices || false,
                lastRunAt: setting?.lastRunAt || null
            };
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error getting auto cleanup settings:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy cài đặt' });
    }
};

// Cập nhật cài đặt auto cleanup cho một admin
exports.updateAutoCleanupSettings = async (req, res) => {
    try {
        const { adminId, enabled, cleanupAfterHours, keepUnpaidWinningInvoices } = req.body;

        if (!adminId) {
            return res.status(400).json({ success: false, message: 'Thiếu adminId' });
        }

        // Kiểm tra admin có tồn tại không
        const admin = await User.findOne({ _id: adminId, role: 'admin' });
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin không tồn tại' });
        }

        // Validation
        if (cleanupAfterHours !== undefined) {
            if (cleanupAfterHours < 1 || cleanupAfterHours > 720) {
                return res.status(400).json({
                    success: false,
                    message: 'Thời gian xóa phải từ 1 đến 720 giờ (30 ngày)'
                });
            }
        }

        // Upsert settings
        const updatedSettings = await AutoCleanupSettings.findOneAndUpdate(
            { adminId },
            {
                adminId,
                enabled: enabled !== undefined ? enabled : false,
                cleanupAfterHours: cleanupAfterHours || 24,
                keepUnpaidWinningInvoices: keepUnpaidWinningInvoices || false
            },
            { upsert: true, new: true }
        );

        res.json({
            success: true,
            message: 'Cập nhật cài đặt thành công',
            data: updatedSettings
        });
    } catch (error) {
        console.error('Error updating auto cleanup settings:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật cài đặt' });
    }
};

// Hàm thực hiện auto cleanup (được gọi bởi cron job hoặc scheduled task)
exports.performAutoCleanup = async () => {
    try {
        console.log('[AUTO CLEANUP] Starting automated cleanup process...');

        // Lấy tất cả settings đang bật
        const activeSettings = await AutoCleanupSettings.find({ enabled: true });

        if (activeSettings.length === 0) {
            console.log('[AUTO CLEANUP] No active cleanup settings found');
            return;
        }

        // Lấy thời gian hiện tại theo VN timezone
        const now = new Date();
        const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));

        let totalResults = {
            adminsProcessed: 0,
            invoicesDeleted: 0,
            winningInvoicesDeleted: 0,
            winningInvoicesKept: 0,
            dailyReportsDeleted: 0,
            snapshotsDeleted: 0,
            historiesDeleted: 0
        };

        for (const setting of activeSettings) {
            try {
                // Skip if adminId is undefined/null
                if (!setting.adminId) {
                    console.log(`[AUTO CLEANUP] Skipping setting with undefined adminId`);
                    continue;
                }

                console.log(`\n[AUTO CLEANUP] ========== Processing admin ${setting.adminId} ==========`);
                console.log(`[AUTO CLEANUP] Settings: cleanupAfterHours=${setting.cleanupAfterHours}, keepUnpaid=${setting.keepUnpaidWinningInvoices}`);
                console.log(`[AUTO CLEANUP] Current VN time: ${vnNow.toLocaleString('vi-VN')}`);

                // Lấy danh sách stores của admin này
                const stores = await Store.find({ adminId: setting.adminId });
                const storeIds = stores.map(s => s._id);

                if (storeIds.length === 0) {
                    console.log(`[AUTO CLEANUP] No stores found for admin ${setting.adminId}`);
                    continue;
                }

                console.log(`[AUTO CLEANUP] Found ${stores.length} stores`);

                // Tính ngày nào cần xóa
                // Logic: Dữ liệu của ngày X sẽ bị xóa sau cleanupAfterHours kể từ 00:00 của ngày X+1
                // Ví dụ: cleanupAfterHours = 2
                //   - Dữ liệu ngày 24 → xóa sau 00:00 ngày 25 + 2h = 02:00 ngày 25

                const daysToCheck = 30; // Kiểm tra 30 ngày gần nhất

                for (let i = 1; i <= daysToCheck; i++) {
                    // Tính ngày cần kiểm tra (i ngày trước)
                    const targetDate = new Date(vnNow);
                    targetDate.setDate(vnNow.getDate() - i);

                    // Lấy 00:00:00 và 23:59:59 của ngày đó (VN timezone)
                    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
                    const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

                    // Tính thời điểm xóa: 00:00 ngày kế tiếp + cleanupAfterHours
                    const nextDayStart = new Date(targetDate);
                    nextDayStart.setDate(targetDate.getDate() + 1);
                    nextDayStart.setHours(0, 0, 0, 0);

                    const deleteTime = new Date(nextDayStart.getTime() + (setting.cleanupAfterHours * 60 * 60 * 1000));

                    // Kiểm tra xem đã đến giờ xóa chưa
                    if (vnNow < deleteTime) {
                        console.log(`[AUTO CLEANUP] Day ${targetDate.toLocaleDateString('vi-VN')} not ready for deletion yet (delete at ${deleteTime.toLocaleString('vi-VN')})`);
                        continue;
                    }

                    console.log(`[AUTO CLEANUP] Deleting data for day ${targetDate.toLocaleDateString('vi-VN')} (${dayStart.toISOString()} to ${dayEnd.toISOString()})`);

                    // Xóa invoices của ngày này
                    const invoiceDeleteResult = await Invoice.deleteMany({
                        storeId: { $in: storeIds },
                        createdAt: { $gte: dayStart, $lte: dayEnd }
                    });
                    totalResults.invoicesDeleted += invoiceDeleteResult.deletedCount || 0;

                    // Xử lý winning invoices
                    if (setting.keepUnpaidWinningInvoices) {
                        // Chỉ xóa winning invoices đã trả
                        const winningDeleteResult = await WinningInvoice.deleteMany({
                            storeId: { $in: storeIds },
                            createdAt: { $gte: dayStart, $lte: dayEnd },
                            isPaid: true
                        });
                        totalResults.winningInvoicesDeleted += winningDeleteResult.deletedCount || 0;

                        // Đếm số winning invoices giữ lại
                        const keptCount = await WinningInvoice.countDocuments({
                            storeId: { $in: storeIds },
                            createdAt: { $gte: dayStart, $lte: dayEnd },
                            isPaid: false
                        });
                        totalResults.winningInvoicesKept += keptCount;

                        if (keptCount > 0) {
                            console.log(`[AUTO CLEANUP] Kept ${keptCount} unpaid winning invoices for day ${targetDate.toLocaleDateString('vi-VN')}`);
                        }
                    } else {
                        // Xóa tất cả winning invoices
                        const winningDeleteResult = await WinningInvoice.deleteMany({
                            storeId: { $in: storeIds },
                            createdAt: { $gte: dayStart, $lte: dayEnd }
                        });
                        totalResults.winningInvoicesDeleted += winningDeleteResult.deletedCount || 0;
                    }

                    // Xóa daily reports
                    const dailyReportDeleteResult = await DailyReport.deleteMany({
                        storeId: { $in: storeIds },
                        createdAt: { $gte: dayStart, $lte: dayEnd }
                    });
                    totalResults.dailyReportsDeleted += dailyReportDeleteResult.deletedCount || 0;

                    // Xóa message export snapshots
                    // Debug: Đếm trước khi xóa
                    const snapshotCountBefore = await MessageExportSnapshot.countDocuments({
                        adminId: setting.adminId,
                        createdAt: { $gte: dayStart, $lte: dayEnd }
                    });

                    console.log(`[AUTO CLEANUP] Found ${snapshotCountBefore} snapshots for admin ${setting.adminId} on day ${targetDate.toLocaleDateString('vi-VN')}`);

                    const snapshotDeleteResult = await MessageExportSnapshot.deleteMany({
                        adminId: setting.adminId,
                        createdAt: { $gte: dayStart, $lte: dayEnd }
                    });
                    totalResults.snapshotsDeleted += snapshotDeleteResult.deletedCount || 0;

                    console.log(`[AUTO CLEANUP] Deleted ${snapshotDeleteResult.deletedCount} snapshots`);

                    // Xóa invoice histories
                    const historyDeleteResult = await InvoiceHistory.deleteMany({
                        storeId: { $in: storeIds },
                        timestamp: { $gte: dayStart, $lte: dayEnd }
                    });
                    totalResults.historiesDeleted += historyDeleteResult.deletedCount || 0;
                }

                // Cập nhật lastRunAt
                setting.lastRunAt = now;
                await setting.save();

                totalResults.adminsProcessed++;

                console.log(`[AUTO CLEANUP] Completed for admin ${setting.adminId}`);
            } catch (adminError) {
                console.error(`[AUTO CLEANUP] Error processing admin ${setting.adminId}:`, adminError);
            }
        }

        console.log('[AUTO CLEANUP] Cleanup completed:', totalResults);
        return totalResults;
    } catch (error) {
        console.error('[AUTO CLEANUP] Fatal error during cleanup:', error);
        throw error;
    }
};

// Endpoint để trigger manual run (cho testing)
exports.triggerManualCleanup = async (req, res) => {
    try {
        const results = await exports.performAutoCleanup();
        res.json({
            success: true,
            message: 'Auto cleanup đã chạy thành công',
            results
        });
    } catch (error) {
        console.error('Error triggering manual cleanup:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi chạy cleanup' });
    }
};
