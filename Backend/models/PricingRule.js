// Backend/models/PricingRule.js
const mongoose = require('mongoose');

const pricingRuleSchema = new mongoose.Schema({
  ruleName: { type: String, required: true },
  // Ép buộc lưu dưới dạng String định dạng "HH:mm"
  startTime: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
  endTime: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
  price: { type: Number, required: true },
  dayType: { type: String, enum: ['Weekday', 'Weekend', 'Holiday'], default: 'Weekday' },
  isPeakHour: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('PricingRule', pricingRuleSchema);