const mongoose = require('mongoose');
const Booking = require('../models/Booking');

const HOLD_DURATION_MS = 3 * 60 * 1000;

const activeConflictStatuses = [
  'pending',
  'Pending',
  'PENDING',
  'confirmed',
  'Confirmed',
  'CONFIRMED',
  'playing',
  'Playing',
  'PLAYING',
  'PENDING_PAYMENT',
  'cancel_requested'
];

const pendingPaymentStatuses = ['pending', 'Pending', 'PENDING', 'UNPAID'];
const lockedPaymentStatuses = ['paid', 'success', 'Paid', 'PAID', 'SUCCESS', 'deposit', 'unpaid', 'UNPAID'];

const normalizeTime = (time) => {
  const [hour, minute] = String(time).split(':').map(Number);
  return `${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;
};

const getActivePendingHoldQuery = () => ({
  $or: [
    { holdExpiresAt: { $gt: new Date() } },
    { holdExpiresAt: { $exists: false }, createdAt: { $gt: new Date(Date.now() - HOLD_DURATION_MS) } }
  ]
});

const getBlockingBookingPaymentQuery = () => ({
  $or: [
    { paymentStatus: { $in: lockedPaymentStatuses } },
    { paymentStatus: { $in: pendingPaymentStatuses }, ...getActivePendingHoldQuery() }
  ]
});

const formatConflictBooking = (booking) => ({
  bookingId: booking._id,
  fieldName: booking.field?.fieldName || booking.field?.name || 'Sân',
  date: booking.date,
  startTime: normalizeTime(booking.startTime),
  endTime: normalizeTime(booking.endTime),
  status: booking.status
});

const findUserTimeConflict = async ({ userId, fieldId, date, startTime, endTime }) => {
  const conflict = await Booking.findOne({
    user: new mongoose.Types.ObjectId(userId),
    field: { $ne: new mongoose.Types.ObjectId(fieldId) },
    date: String(date).trim(),
    status: { $in: activeConflictStatuses },
    startTime: { $lt: normalizeTime(endTime) },
    endTime: { $gt: normalizeTime(startTime) },
    ...getBlockingBookingPaymentQuery()
  }).populate('field', 'fieldName name');

  return conflict ? formatConflictBooking(conflict) : null;
};

module.exports = {
  findUserTimeConflict
};
