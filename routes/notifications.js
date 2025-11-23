const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../controllers/authController');
const { createNotification, searchRecipients, listMyNotifications, getUnread, markRead, listSent, deleteNotification } = require('../controllers/notificationController');

router.post('/', authenticateToken, createNotification);
router.get('/recipients', authenticateToken, searchRecipients);
router.get('/', authenticateToken, listMyNotifications);
router.get('/unread', authenticateToken, getUnread);
router.post('/:id/read', authenticateToken, markRead);
router.get('/sent', authenticateToken, listSent);
router.delete('/:id', authenticateToken, deleteNotification);

module.exports = router;