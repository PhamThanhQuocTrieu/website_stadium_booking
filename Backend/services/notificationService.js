const Notification = require('../models/Notification');
const { emitToUser } = require('../utils/socket');

const buildNotificationDedupeQuery = ({ user, title, type, relatedId, relatedModel, metadata }) => {
  const query = { user, title, type };

  if (metadata?.waitlistId) {
    return { ...query, 'metadata.waitlistId': String(metadata.waitlistId) };
  }

  if (metadata?.bookingId) {
    return { ...query, 'metadata.bookingId': String(metadata.bookingId) };
  }

  if (relatedId) {
    return {
      ...query,
      relatedId,
      relatedModel: relatedModel || ''
    };
  }

  return null;
};

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

  const dedupeQuery = buildNotificationDedupeQuery({ user, title, type, relatedId, relatedModel, metadata });
  if (dedupeQuery) {
    const existingNotification = await Notification.findOne(dedupeQuery);
    if (existingNotification) return existingNotification;
  }

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
