const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  readAt: { type: Date, default: null }
}, { _id: false });

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  contentHtml: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scope: { type: String, enum: ['all', 'admins', 'employees', 'custom'], default: 'custom' },
  recipientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  recipients: [recipientSchema],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);