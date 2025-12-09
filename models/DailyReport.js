const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  expenses: [{
    name: { type: String, required: true },
    amount: { type: Number, required: true }
  }],
  totalRevenue: { type: Number, default: 0 },
  totalPayout: { type: Number, default: 0 },
  netIncome: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Compound index for unique report per store per day
dailyReportSchema.index({ storeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyReport', dailyReportSchema);
