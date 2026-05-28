// File: Backend/models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  field: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Field',
    required: true
  },
  name: { type: String, required: true },
  email: { type: String, required: true },
  comment: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  // Lưu điểm chi tiết từng tiêu chí để sau này Admin thống kê
  ratingsDetail: {
    sanBai: { type: Number, default: 5 },
    trangThietBi: { type: Number, default: 5 },
    dichVu: { type: Number, default: 5 },
    viTriGia: { type: Number, default: 5 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);