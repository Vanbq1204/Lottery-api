const cron = require('node-cron');
const { performAutoCleanup } = require('../controllers/autoCleanupController');
const { performAutoExportMessage } = require('../controllers/messageExportController');

// Chạy auto cleanup mỗi 30 phút
// Format: phút giờ ngày tháng thứ
// '*/30 * * * *' = chạy mỗi 30 phút (00:00, 00:30, 01:00, 01:30, ...)
const scheduleAutoCleanup = () => {
    console.log('[CRON] Setting up auto cleanup cron job...');

    // Chạy mỗi 30 phút
    cron.schedule('*/30 * * * *', async () => {
        console.log('[CRON] Running auto cleanup task...');
        try {
            const results = await performAutoCleanup();
            if (results && results.adminsProcessed > 0) {
                console.log('[CRON] Auto cleanup completed:', results);
            } else {
                console.log('[CRON] No data to clean up');
            }
        } catch (error) {
            console.error('[CRON] Error during auto cleanup:', error);
        }
    });

    console.log('[CRON] Auto cleanup cron job scheduled (runs every 30 minutes)');
};

// Chạy tự động xuất tin nhắn lúc 18h30 hàng ngày
// Format: phút giờ ngày tháng thứ
const scheduleAutoExport = () => {
    console.log('[CRON] Setting up auto export message cron job (runs at 18:30)...');

    // Chạy lúc 18:30 mỗi ngày
    cron.schedule('30 18 * * *', async () => {
        console.log('[CRON] Running auto export message task...');
        try {
            const results = await performAutoExportMessage();
            if (results && results.processedCount > 0) {
                console.log('[CRON] Auto export completed for', results.processedCount, 'admins.');
            } else {
                console.log('[CRON] No auto exports configured or needed.');
            }
        } catch (error) {
            console.error('[CRON] Error during auto export message:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh"
    });
};

module.exports = { scheduleAutoCleanup, scheduleAutoExport };
