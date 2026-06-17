const Notification = require('../models/Notification');
const { emitToUser } = require('../utils/socket');

const createNotification = async ({
  user,
  title,
  message,
  type = 'system',
  relatedId,
  relatedModel,
  link,
  metadata,
  io
}) => {
  if (!user || !title || !message) return null;

  const notification = await Notification.create({
    user,
    title,
    message,
    type,
    relatedId,
    relatedModel,
    link,
    metadata
  });

  emitToUser(user, 'notification:new', notification);

  return notification;
};

module.exports = { createNotification };
