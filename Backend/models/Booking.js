const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true },
  
  date: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  
  // Mảng chứa các dịch vụ đã chọn
  services: [{
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    name: String,
    price: Number,
    quantity: { type: Number, default: 1 }
  }],
  
  totalPrice: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
  status: { type: String, enum: ['Confirmed', 'Cancelled'], default: 'Confirmed' }
}, { timestamps: true });

// Index Unique chống trùng lịch
bookingSchema.index({ field: 1, date: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model('Booking', bookingSchema);