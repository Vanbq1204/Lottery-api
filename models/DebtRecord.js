const mongoose = require('mongoose');

const debtRecordSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: String,
        required: true
    },
    debtAmount: {
        type: Number,
        default: 0
    },
    paidAmount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

debtRecordSchema.index({ adminId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DebtRecord', debtRecordSchema);
