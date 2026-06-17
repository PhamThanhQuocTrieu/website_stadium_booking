const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'booking',
  'payment',
  'cancellation',
  'reminder',
  'system',
  'promotion',
  'voucher'
];

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      default: 'system'
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId
    },
    relatedModel: {
      type: String,
      trim: true,
      default: ''
    },
    link: {
      type: String,
      trim: true,
      default: ''
    },
    metadata: {
      type: Object,
      default: {}
    },
    isRead: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1, 'metadata.voucherCode': 1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
