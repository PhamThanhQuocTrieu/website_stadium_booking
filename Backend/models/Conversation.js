const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    assignedAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
      index: true
    },
    lastMessage: {
      type: String,
      default: ''
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true
    },
    unreadByUser: {
      type: Number,
      default: 0
    },
    unreadByAdmin: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

conversationSchema.index({ userId: 1, status: 1 });
conversationSchema.index({ lastMessageAt: -1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
