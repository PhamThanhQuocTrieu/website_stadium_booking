const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true },

  date: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },

  services: [{
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    name: String,
    price: Number,
    quantity: { type: Number, default: 1 }
  }],

  totalPrice: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'],
    default: 'UNPAID'
  },
  paymentMethod: {
    type: String,
    enum: ['CASH', 'VNPAY', 'VIETQR', null],
    default: null
  },
  status: {
    type: String,
    enum: [
      'Pending',
      'Confirmed',
      'Completed',
      'Da hoan thanh',
      'Đã hoàn thành',
      'Cancelled',
      'PENDING_PAYMENT',
      'CONFIRMED',
      'CANCELLED',
      'COMPLETED'
    ],
    default: 'Confirmed'
  }
}, { timestamps: true });

bookingSchema.index({ field: 1, date: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model('Booking', bookingSchema);
