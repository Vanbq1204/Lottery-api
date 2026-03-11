const mongoose = require('mongoose');

const adminDebtSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    oldDebt: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    received: { type: Number, default: 0 },
    todayAmount: { type: Number, default: 0 },
    lastUpdatedDate: { type: String },
    hasAddedToday: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('AdminDebt', adminDebtSchema);
