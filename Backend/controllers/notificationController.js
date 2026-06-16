const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { NOTIFICATION_TYPES } = require('../models/Notification');
const User = require('../models/User');
const { createNotification } = require('../services/notificationService');

const getUserId = (req) => req.user?.id || req.user?._id;
const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.getMyNotifications = async (req, res) => {
  try {
    const userId = getUserId(req);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);
    const type = String(req.query.type || '').trim();
    const unread = String(req.query.unread || '').toLowerCase() === 'true';

    const filter = { user: userId };
    if (type && NOTIFICATION_TYPES.includes(type)) filter.type = type;
    if (unread) filter.isRead = false;

    const [notifications, unreadCount, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ user: userId, isRead: false }),
      Notification.countDocuments(filter)
    ]);

    res.json({
      notifications,
      unreadCount,
      total,
      page,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải thông báo.', error: error.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Mã thông báo không hợp lệ.' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Không tìm thấy thông báo.' });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật thông báo.', error: error.message });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = getUserId(req);
    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({
      message: 'Đã đánh dấu tất cả thông báo là đã đọc.',
      modifiedCount: result.modifiedCount || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể cập nhật thông báo.', error: error.message });
  }
};

exports.deleteMyNotification = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Mã thông báo không hợp lệ.' });
    }

    const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: userId });
    if (!notification) {
      return res.status(404).json({ message: 'Không tìm thấy thông báo.' });
    }

    res.json({ message: 'Đã xóa thông báo.' });
  } catch (error) {
    res.status(500).json({ message: 'Không thể xóa thông báo.', error: error.message });
  }
};

exports.adminCreateNotification = async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();
    const type = String(req.body.type || 'system').trim();
    const targetUser = String(req.body.user || req.body.userId || '').trim();

    if (!title || !message) {
      return res.status(400).json({ message: 'Tiêu đề và nội dung không được để trống.' });
    }
    if (!['system', 'promotion'].includes(type)) {
      return res.status(400).json({ message: 'Admin chỉ được gửi thông báo hệ thống hoặc khuyến mãi.' });
    }
    if (targetUser && !isObjectId(targetUser)) {
      return res.status(400).json({ message: 'Người nhận không hợp lệ.' });
    }

    const io = req.app.get('io');
    let targetUsers = [];
    if (targetUser) {
      const user = await User.findById(targetUser).select('_id role');
      if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
      targetUsers = [user._id];
    } else {
      const users = await User.find({ role: 'user' }).select('_id');
      targetUsers = users.map((user) => user._id);
    }

    const notifications = [];
    for (const userId of targetUsers) {
      const notification = await createNotification({
        user: userId,
        title,
        message,
        type,
        relatedModel: 'AdminNotification',
        io
      });
      if (notification) notifications.push(notification);
    }

    res.status(201).json({
      message: `Đã gửi ${notifications.length} thông báo.`,
      count: notifications.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể gửi thông báo.', error: error.message });
  }
};

exports.adminGetNotifications = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const type = String(req.query.type || '').trim();

    const filter = {};
    if (type && NOTIFICATION_TYPES.includes(type)) filter.type = type;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate('user', 'fullName email role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter)
    ]);

    res.json({
      notifications,
      total,
      page,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải lịch sử thông báo.', error: error.message });
  }
};
