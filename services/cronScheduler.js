const cron = require('node-cron');
const { performAutoCleanup } = require('../controllers/autoCleanupController');

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

module.exports = { scheduleAutoCleanup };
