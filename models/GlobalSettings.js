const mongoose = require('mongoose');

const globalSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g., 'global'
  forceReloginAt: { type: Date, default: null },
  maintenanceMode: { type: Boolean, default: false }, // Trạng thái bảo trì hệ thống
  maintenanceActivatedAt: { type: Date, default: null }, // Thời điểm kích hoạt bảo trì
}, { timestamps: true });

module.exports = mongoose.model('GlobalSettings', globalSettingsSchema);