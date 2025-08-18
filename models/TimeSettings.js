const mongoose = require('mongoose');

const timeSettingsSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  bettingCutoffTime: {
    type: String, // Format: "HH:MM" (24h format)
    required: true,
    default: "18:30"
  },
  timezone: {
    type: String,
    default: "Asia/Ho_Chi_Minh"
  },
  isActive: {
    type: Boolean,
    default: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for faster queries
timeSettingsSchema.index({ adminId: 1 });

module.exports = mongoose.model('TimeSettings', timeSettingsSchema); 