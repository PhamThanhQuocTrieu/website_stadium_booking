const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Tiêu đề banner là bắt buộc'],
    trim: true
  },
  subtitle: { type: String, trim: true, default: '' },
  description: { type: String, trim: true, default: '' },
  image: {
    type: String,
    required: [true, 'Ảnh banner là bắt buộc'],
    trim: true
  },
  buttonText: { type: String, trim: true, default: '' },
  buttonLink: { type: String, trim: true, default: '' },
  voucherCode: { type: String, trim: true, uppercase: true, default: '' },
  position: {
    type: String,
    enum: ['home_hero', 'home_promo'],
    default: 'home_hero'
  },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null }
}, { timestamps: true });

bannerSchema.index({ position: 1, isActive: 1, order: 1, createdAt: 1 });

module.exports = mongoose.model('Banner', bannerSchema);
