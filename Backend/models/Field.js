// File: Backend/models/Field.js
const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: { type: String },
  isAvailable: { type: Boolean, default: false }
});

// Định nghĩa cấu trúc giá ngay tại đây
const pricingRuleSchema = new mongoose.Schema({
  ruleName: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  price: { type: Number, required: true },
  dayType: { type: String, enum: ['Weekday', 'Weekend', 'Holiday'], default: 'Weekday' },
  isPeakHour: { type: Boolean, default: false }
});

const fieldSchema = new mongoose.Schema({
  fieldName: { type: String, required: true },
  type: { type: String, enum: ['Bóng đá', 'Pickleball', 'Cầu lông', 'Tennis'], required: true },
  address: { type: String, required: true },
  image: { type: String, default: '' },
  gallery: [{ type: String }],
  description: { type: String, default: '' },
  isFeatured: { type: Boolean, default: false },
  ratingAverage: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  status: { type: String, enum: ['Active', 'Maintenance', 'Full'], default: 'Active' },
  services: [serviceSchema],
  pricingRules: [pricingRuleSchema] // 🌟 LƯU TRỰC TIẾP TẠI ĐÂY
}, { timestamps: true });

module.exports = mongoose.model('Field', fieldSchema);
