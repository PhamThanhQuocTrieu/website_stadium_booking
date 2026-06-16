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
  subtotal: { type: Number, default: 0 },
  serviceTotal: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  transactionFee: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'success', 'failed', 'refunded', 'Pending', 'Paid', 'UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'],
    default: 'UNPAID'
  },
  paymentMethod: {
    type: String,
    enum: ['CASH', 'VNPAY', 'VIETQR', null],
    default: null
  },
  transactionId: String,
  txnRef: String,
  status: {
    type: String,
    enum: [
      'pending',
      'confirmed',
      'playing',
      'completed',
      'cancel_requested',
      'cancelled',
      'refunded',
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
  },
  cancelledAt: Date,
  cancelReason: String,
  holdExpiresAt: Date,
  reviewed: { type: Boolean, default: false }
}, { timestamps: true });

const activeSlotStatuses = [
  'pending',
  'confirmed',
  'playing',
  'completed',
  'cancel_requested',
  'Pending',
  'Confirmed',
  'Completed',
  'PENDING_PAYMENT',
  'CONFIRMED',
  'COMPLETED'
];

bookingSchema.index(
  { field: 1, date: 1, startTime: 1 },
  {
    unique: true,
    name: 'unique_active_booking_slot',
    partialFilterExpression: { status: { $in: activeSlotStatuses } }
  }
);

module.exports = mongoose.model('Booking', bookingSchema);
