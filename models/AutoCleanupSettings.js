const mongoose = require('mongoose');

const autoCleanupSettingsSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    enabled: {
        type: Boolean,
        default: false
    },
    // Thời gian sau khi tạo hóa đơn sẽ tự động xóa (tính bằng giờ)
    // Ví dụ: 12 = sau 12 giờ, 24 = sau 24 giờ
    cleanupAfterHours: {
        type: Number,
        default: 24,
        min: 1,
        max: 720 // Tối đa 30 ngày
    },
    keepUnpaidWinningInvoices: {
        type: Boolean,
        default: false
    },
    lastRunAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Index để tìm kiếm nhanh
autoCleanupSettingsSchema.index({ adminId: 1 });
autoCleanupSettingsSchema.index({ enabled: 1 });

module.exports = mongoose.model('AutoCleanupSettings', autoCleanupSettingsSchema);
