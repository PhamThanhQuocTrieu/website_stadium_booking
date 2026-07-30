const mongoose = require('mongoose');

const bookingWaitlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true },
  date: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  sourceBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  status: {
    type: String,
    enum: ['waiting', 'notified', 'cancelled'],
    default: 'waiting'
  },
  notifiedAt: Date
}, { timestamps: true });

bookingWaitlistSchema.index(
  { user: 1, field: 1, date: 1, startTime: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'waiting' }
  }
);
bookingWaitlistSchema.index({ sourceBooking: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('BookingWaitlist', bookingWaitlistSchema);
