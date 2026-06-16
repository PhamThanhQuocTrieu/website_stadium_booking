const Notification = require('../models/Notification');

const createNotification = async ({
  user,
  title,
  message,
  type = 'system',
  relatedId,
  relatedModel,
  io
}) => {
  if (!user || !title || !message) return null;

  const notification = await Notification.create({
    user,
    title,
    message,
    type,
    relatedId,
    relatedModel
  });

  // Socket user rooms are not wired in this project yet. This event is harmless
  // and gives a clear upgrade point once authenticated socket rooms are added.
  if (io) {
    io.emit('notification:new', {
      user: String(user),
      notification
    });
  }

  return notification;
};

module.exports = { createNotification };
