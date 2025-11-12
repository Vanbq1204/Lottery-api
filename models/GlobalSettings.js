const mongoose = require('mongoose');

const globalSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g., 'global'
  forceReloginAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('GlobalSettings', globalSettingsSchema);