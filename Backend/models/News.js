const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },

  slug: {
    type: String,
    unique: true,
    index: true
  },

  summary: {
    type: String,
    trim: true
  },

  content: {
    type: String,
    required: true
  },

  thumbnail: {
    type: String,
    default: ''
  },

  category: {
    type: String,
    enum: [
      'Khuyến mãi',
      'Hướng dẫn đặt sân',
      'Sự kiện thể thao',
      'Thông báo hệ thống',
      'Tin tức chung'
    ],
    default: 'Tin tức chung'
  },

  tags: [{
    type: String,
    trim: true
  }],

  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  newsType: {
    type: String,
    enum: ['internal'],
    default: 'internal'
  },

  status: {
    type: String,
    enum: ['draft', 'published', 'hidden'],
    default: 'draft'
  },

  isFeatured: {
    type: Boolean,
    default: false
  },

  views: {
    type: Number,
    default: 0
  },

  publishedAt: {
    type: Date
  }
}, {
  timestamps: true
});

newsSchema.index({ status: 1, publishedAt: -1, createdAt: -1 });
newsSchema.index({ newsType: 1 });

module.exports = mongoose.model('News', newsSchema);
