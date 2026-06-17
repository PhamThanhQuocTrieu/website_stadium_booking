const mongoose = require('mongoose');

const recurringBookingSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  customerName: String,
  customerPhone: String,
  court: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  daysOfWeek: [{ type: Number }],
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  note: String,
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'deposit', 'paid', 'UNPAID', 'PAID', 'Pending', 'Paid'],
    default: 'unpaid'
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'completed'],
    default: 'active'
  },
  bookingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cancelledAt: Date,
  cancelReason: String,
  updateHistory: [{
    oldCourt: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' },
    newCourt: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' },
    oldStartDate: String,
    oldEndDate: String,
    newStartDate: String,
    newEndDate: String,
    oldDaysOfWeek: [Number],
    newDaysOfWeek: [Number],
    oldStartTime: String,
    oldEndTime: String,
    newStartTime: String,
    newEndTime: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    updatedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('RecurringBooking', recurringBookingSchema);
