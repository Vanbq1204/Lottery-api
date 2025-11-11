const mongoose = require('mongoose');

const messagesSchema = new mongoose.Schema({
  loto: { type: String, default: '' },
  twoS: { type: String, default: '' },
  threeS: { type: String, default: '' },
  fourS: { type: String, default: '' },
  tong: { type: String, default: '' },
  dau: { type: String, default: '' },
  dit: { type: String, default: '' },
  kep: { type: String, default: '' },
  bo: { type: String, default: '' },
  xien: { type: String, default: '' },
  xienquay: { type: String, default: '' }
}, { _id: false });

const messageExportSnapshotSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD (Vietnam timezone)
  sequence: { type: Number, required: true }, // 1,2,... per day
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  messages: { type: messagesSchema, required: true },
  createdAt: { type: Date, default: Date.now }
});

messageExportSnapshotSchema.index({ adminId: 1, date: 1, sequence: 1 }, { unique: true });

module.exports = mongoose.model('MessageExportSnapshot', messageExportSnapshotSchema);