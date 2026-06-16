const express = require('express');
const router = express.Router();
const {
  adminCreateNotification,
  adminGetNotifications
} = require('../controllers/notificationController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/', protect, adminOnly, adminGetNotifications);
router.post('/', protect, adminOnly, adminCreateNotification);

module.exports = router;
