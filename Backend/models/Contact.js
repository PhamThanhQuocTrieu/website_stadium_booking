const mongoose = require('mongoose');

const CONTACT_CATEGORIES = [
  'booking_support',
  'payment_support',
  'cancel_request',
  'complaint',
  'system_error',
  'other'
];

const CONTACT_STATUSES = ['new', 'processing', 'replied', 'closed'];

const contactSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: CONTACT_CATEGORIES
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: CONTACT_STATUSES,
      default: 'new'
    },
    adminReply: {
      type: String,
      default: '',
      trim: true
    },
    repliedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

contactSchema.index({ fullName: 'text', email: 'text', phone: 'text', subject: 'text' });
contactSchema.index({ status: 1, category: 1, createdAt: -1 });

module.exports = mongoose.model('Contact', contactSchema);
module.exports.CONTACT_CATEGORIES = CONTACT_CATEGORIES;
module.exports.CONTACT_STATUSES = CONTACT_STATUSES;
