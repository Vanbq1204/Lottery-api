const Notification = require('../models/Notification');
const User = require('../models/User');

const createNotification = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Chỉ Super Admin mới có quyền gửi thông báo' });
    }

    const { title, contentHtml, scope, recipientIds } = req.body;
    if (!title || !contentHtml) {
      return res.status(400).json({ success: false, message: 'Thiếu tiêu đề hoặc nội dung' });
    }

    let recipients = [];
    if (scope === 'all') {
      const users = await User.find({ role: { $in: ['admin', 'employee'] }, isActive: true }, '_id');
      recipients = users.map(u => u._id);
    } else if (scope === 'admins') {
      const users = await User.find({ role: 'admin', isActive: true }, '_id');
      recipients = users.map(u => u._id);
    } else if (scope === 'employees') {
      const users = await User.find({ role: 'employee', isActive: true }, '_id');
      recipients = users.map(u => u._id);
    } else if (scope === 'custom') {
      const ids = Array.isArray(recipientIds) ? recipientIds.filter(Boolean) : [];
      const users = await User.find({ _id: { $in: ids }, isActive: true }, '_id');
      recipients = users.map(u => u._id);
    } else {
      return res.status(400).json({ success: false, message: 'Phạm vi người nhận không hợp lệ' });
    }

    const notif = await Notification.create({
      title,
      contentHtml,
      authorId: req.user._id,
      scope,
      recipientIds: recipients,
      recipients: recipients.map(id => ({ userId: id }))
    });

    try {
      const io = req.app.get('socketio');
      if (io) {
        recipients.forEach(userId => {
          io.to(userId.toString()).emit('new_notification', { id: notif._id.toString(), title: notif.title });
        });
      }
    } catch (_) { }

    res.json({ success: true, notification: notif });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo thông báo' });
  }
};

const searchRecipients = async (req, res) => {
  try {
    const { q = '', role } = req.query;
    const query = { isActive: true };
    if (role && ['admin', 'employee'].includes(role)) query.role = role;
    if (q && q.trim().length > 0) {
      const t = q.trim();
      query.$or = [
        { username: { $regex: t, $options: 'i' } },
        { name: { $regex: t, $options: 'i' } },
        { storeName: { $regex: t, $options: 'i' } }
      ];
    }
    const users = await User.find(query).limit(50);
    res.json(users.map(u => ({ id: u._id, name: u.name, username: u.username, role: u.role, storeName: u.storeName })));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server khi tìm người nhận' });
  }
};

const listMyNotifications = async (req, res) => {
  try {
    const { status } = req.query;
    const notifs = await Notification.find({ recipientIds: req.user._id, isActive: true }).sort({ createdAt: -1 });
    const mapped = notifs.map(n => {
      const r = (n.recipients || []).find(x => String(x.userId) === String(req.user._id));
      const isRead = Boolean(r && r.readAt);
      return { id: n._id, title: n.title, contentHtml: n.contentHtml, createdAt: n.createdAt, isRead };
    });
    const filtered = status === 'unread' ? mapped.filter(m => !m.isRead) : status === 'read' ? mapped.filter(m => m.isRead) : mapped;
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy thông báo' });
  }
};

const getUnread = async (req, res) => {
  try {
    const notifs = await Notification.find({ recipientIds: req.user._id, isActive: true }).sort({ createdAt: -1 });
    const unread = notifs.filter(n => {
      const r = (n.recipients || []).find(x => String(x.userId) === String(req.user._id));
      return !(r && r.readAt);
    }).map(n => ({ id: n._id, title: n.title, contentHtml: n.contentHtml, createdAt: n.createdAt }));
    res.json(unread);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy thông báo chưa đọc' });
  }
};

const markRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Notification.findById(id);
    if (!notif) return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    if (!notif.recipientIds.map(x => String(x)).includes(String(req.user._id))) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }
    const idx = (notif.recipients || []).findIndex(x => String(x.userId) === String(req.user._id));
    if (idx >= 0) {
      notif.recipients[idx].readAt = new Date();
    } else {
      notif.recipients.push({ userId: req.user._id, readAt: new Date() });
    }
    await notif.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server khi đánh dấu đã đọc' });
  }
};

const listSent = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }
    const notifs = await Notification.find({ authorId: req.user._id }).sort({ createdAt: -1 }).populate('authorId', 'name username');
    res.json(notifs.map(n => ({ id: n._id, title: n.title, contentHtml: n.contentHtml, scope: n.scope, recipientsCount: (n.recipientIds || []).length, createdAt: n.createdAt, authorName: n.authorId?.name || n.authorId?.username || 'Super Admin' })));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách đã gửi' });
  }
};

const deleteNotification = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }
    const { id } = req.params;
    await Notification.findByIdAndDelete(id);
    res.json({ success: true, message: 'Đã xoá thông báo' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server khi xoá thông báo' });
  }
};

module.exports = { createNotification, searchRecipients, listMyNotifications, getUnread, markRead, listSent, deleteNotification };