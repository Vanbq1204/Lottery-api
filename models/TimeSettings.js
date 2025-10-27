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
  editDeleteCutoffTime: {
    type: String, // Format: "HH:MM" (24h format)
    default: "18:15"
  },
  editDeleteLimitActive: {
    type: Boolean,
    default: false
  },
  // Thời gian giới hạn cho lô, xiên, xiên quay (chung)
  specialBetsCutoffTime: {
    type: String, // Format: "HH:MM" (24h format)
    default: "18:15"
  },
  // Trạng thái kích hoạt giới hạn cho lô, xiên, xiên quay
  specialBetsLimitActive: {
    type: Boolean,
    default: false
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