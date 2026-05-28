// File: Backend/models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true },
  
  date: { type: String, required: true },      // Định dạng chuỗi: "2026-05-19"
  startTime: { type: String, required: true }, // Định dạng chuỗi: "17:00"
  endTime: { type: String, required: true },   // Định dạng chuỗi: "18:00"
  
  totalPrice: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
  status: { type: String, enum: ['Confirmed', 'Cancelled'], default: 'Confirmed' }
}, { timestamps: true });

// Hệ thống Index Unique chống trùng lịch vật lý cứng cho luận văn
bookingSchema.index({ field: 1, date: 1, startTime: 1 }, { unique: true });

// 🌟 KIỂM TRA KỸ DÒNG NÀY: Phải có chữ "exports" số nhiều!
module.exports = mongoose.model('Booking', bookingSchema);