const express = require('express');
const router = express.Router();
const {
  deleteMyNotification,
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead
} = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', protect, getMyNotifications);
router.patch('/read-all', protect, markAllNotificationsRead);
router.patch('/:id/read', protect, markNotificationRead);
router.delete('/:id', protect, deleteMyNotification);

module.exports = router;
