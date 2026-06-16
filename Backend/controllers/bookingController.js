const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Field = require('../models/Field');
const Review = require('../models/Review');
const Payment = require('../models/Payment');
const cron = require('node-cron');

const normalizeTime = (time) => {
  const [hour, minute] = String(time).split(':').map(Number);
  return `${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;
};

const timeToMinutes = (time) => {
  const [hour, minute] = normalizeTime(time).split(':').map(Number);
  return hour * 60 + minute;
};

const getRulePrice = (pricingRules, slotTime, isWeekend) => {
  const slotMinutes = timeToMinutes(slotTime);
  const dayType = isWeekend ? 'Weekend' : 'Weekday';
  const sameDayRules = pricingRules.filter((pricingRule) => pricingRule.dayType === dayType);
  const rulesForFallback = sameDayRules.length > 0 ? sameDayRules : pricingRules;

  const matchedRule = rulesForFallback.find((pricingRule) => {
    const startMinutes = timeToMinutes(pricingRule.startTime);
    const endMinutes = timeToMinutes(pricingRule.endTime);
    if (startMinutes === endMinutes) return true;
    if (endMinutes > startMinutes) {
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    }
    return slotMinutes >= startMinutes || slotMinutes < endMinutes;
  });

  if (matchedRule) return Number(matchedRule.price || 0);

  const fallbackPrices = rulesForFallback
    .map((pricingRule) => Number(pricingRule.price || 0))
    .filter((price) => price > 0);

  return fallbackPrices.length > 0 ? Math.min(...fallbackPrices) : 100000;
};

const addMinutes = (time, minutesToAdd) => {
  const [hour, minute] = normalizeTime(time).split(':').map(Number);
  const totalMinutes = hour * 60 + minute + minutesToAdd;
  const nextHour = Math.floor(totalMinutes / 60);
  const nextMinute = totalMinutes % 60;
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
};

const expandBookingSlots = (booking) => {
  const slots = [];
  let current = normalizeTime(booking.startTime);
  const endTime = normalizeTime(booking.endTime);

  while (current < endTime) {
    slots.push(current);
    current = addMinutes(current, 30);
  }

  return slots;
};

const HOLD_DURATION_MS = 5 * 60 * 1000;
const getHoldExpiredAt = () => new Date(Date.now() - HOLD_DURATION_MS);
const getHoldExpiresAt = () => new Date(Date.now() + HOLD_DURATION_MS);
const getActivePendingHoldQuery = () => ({
  $or: [
    { holdExpiresAt: { $gt: new Date() } },
    { holdExpiresAt: { $exists: false }, createdAt: { $gt: getHoldExpiredAt() } }
  ]
});

const activeBookingStatuses = ['confirmed', 'Confirmed', 'CONFIRMED', 'PENDING_PAYMENT', 'cancel_requested'];
const paidPaymentStatuses = ['paid', 'success', 'Paid', 'PAID'];
const pendingPaymentStatuses = ['pending', 'Pending', 'PENDING', 'UNPAID'];
const completedBookingStatuses = ['completed', 'Completed', 'COMPLETED', 'Da hoan thanh', 'ÄÃ£ hoÃ n thÃ nh'];
const cancelledBookingStatuses = ['cancelled', 'Cancelled', 'CANCELLED'];
const paidLikePaymentStatuses = ['paid', 'success', 'Paid', 'PAID', 'SUCCESS'];
const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
const paidLikeStatusSet = paidLikePaymentStatuses.map(normalizeStatus);
const completedStatusSet = completedBookingStatuses.map(normalizeStatus);
const cancelledStatusSet = cancelledBookingStatuses.map(normalizeStatus);
const isPaidBooking = (booking, payment) => {
  return paidLikeStatusSet.includes(normalizeStatus(payment?.status)) ||
    paidLikeStatusSet.includes(normalizeStatus(booking?.paymentStatus));
};
const getBookingEndDate = (booking) => new Date(`${booking.date}T${normalizeTime(booking.endTime)}:00`);

const cancelExpiredPendingBookings = async () => {
  return Booking.updateMany(
    {
      paymentStatus: { $in: pendingPaymentStatuses },
      status: { $in: activeBookingStatuses },
      $or: [
        { holdExpiresAt: { $lte: new Date() } },
        { holdExpiresAt: { $exists: false }, createdAt: { $lte: getHoldExpiredAt() } }
      ]
    },
    { $set: { status: 'Cancelled', paymentStatus: 'FAILED' }, $unset: { holdExpiresAt: '' } }
  );
};

const completePastPaidBookings = async () => {
  const candidates = await Booking.find({
    status: { $in: ['confirmed', 'Confirmed', 'CONFIRMED'] },
    paymentStatus: { $in: paidPaymentStatuses }
  }).select('_id date endTime');

  const completedIds = candidates
    .filter((booking) => {
      const endAt = getBookingEndDate(booking);
      return !Number.isNaN(endAt.getTime()) && endAt < new Date();
    })
    .map((booking) => booking._id);

  if (completedIds.length === 0) return;

  await Booking.updateMany(
    { _id: { $in: completedIds } },
    { $set: { status: 'completed' }, $unset: { holdExpiresAt: '' } }
  );
};

cron.schedule('* * * * *', async () => {
  try {
    await cancelExpiredPendingBookings();
    await completePastPaidBookings();
  } catch (error) {
    console.error('Loi Cron Job:', error.message);
  }
});

exports.getBookingStatus = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { date } = req.query;

    await cancelExpiredPendingBookings();
    await completePastPaidBookings();

    const field = await Field.findById(fieldId);
    if (!field) return res.status(404).json({ message: 'Khong tim thay san!' });

    const queryDateStr = date || new Date().toISOString().split('T')[0];
    const bookings = await Booking.find({
      field: new mongoose.Types.ObjectId(fieldId),
      date: String(queryDateStr).trim(),
      status: { $in: activeBookingStatuses },
      $or: [
        { paymentStatus: { $in: paidPaymentStatuses } },
        { paymentStatus: { $in: pendingPaymentStatuses }, ...getActivePendingHoldQuery() }
      ]
    });

    const bookedSlots = [];
    bookings.forEach((booking) => {
      if (booking.startTime && booking.endTime) {
        bookedSlots.push(...expandBookingSlots(booking));
      }
    });

    return res.status(200).json({
      field: { _id: fieldId, fieldName: field.fieldName, pricingRules: field.pricingRules || [] },
      bookedSlots
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.reserveSlots = async (req, res) => {
  try {
    const { fieldId, date, slots } = req.body;

    if (!fieldId || !date || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ success: false, message: 'Thieu thong tin dat san!' });
    }

    await cancelExpiredPendingBookings();

    const selectedSlots = [...new Set(slots.map(normalizeTime))].sort();
    const startTime = selectedSlots[0];
    const endTime = addMinutes(selectedSlots[selectedSlots.length - 1], 30);

    const field = await Field.findById(fieldId);
    if (!field) return res.status(404).json({ success: false, message: 'Khong tim thay san!' });

    const selectedDateObj = new Date(date);
    const dayOfWeek = selectedDateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const totalPrice = selectedSlots.reduce((total, slotTime) => {
      return total + (getRulePrice(field.pricingRules || [], slotTime, isWeekend) / 2);
    }, 0);

    const confirmedBookings = await Booking.find({
      field: new mongoose.Types.ObjectId(fieldId),
      date,
      status: { $in: activeBookingStatuses },
      $or: [
        { paymentStatus: { $in: paidPaymentStatuses } },
        { paymentStatus: { $in: pendingPaymentStatuses }, ...getActivePendingHoldQuery() }
      ]
    });

    const bookedSlots = new Set();
    confirmedBookings.forEach((booking) => {
      expandBookingSlots(booking).forEach((slot) => bookedSlots.add(slot));
    });

    const hasConflict = selectedSlots.some((slot) => bookedSlots.has(slot));
    if (hasConflict) {
      return res.status(400).json({ success: false, message: 'Khung gio nay da co nguoi dat!' });
    }

    const bookingData = {
      user: new mongoose.Types.ObjectId(req.user.id),
      field: new mongoose.Types.ObjectId(fieldId),
      date,
      startTime,
      endTime,
      totalPrice,
      subtotal: totalPrice,
      serviceTotal: 0,
      discountAmount: 0,
      transactionFee: 0,
      holdExpiresAt: getHoldExpiresAt(),
      paymentStatus: 'Pending',
      status: 'Confirmed'
    };

    const newBooking = await Booking.create(bookingData);

    const io = req.app.get('io');
    if (io) io.emit('slot_booked_success', { fieldId, date, slots: selectedSlots });
    return res.status(200).json({ success: true, bookingId: newBooking._id, totalPrice });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Khung gio nay da co nguoi dat!' });
    }

    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('field');
    if (!booking) return res.status(404).json({ message: 'Khong tim thay don!' });

    const bookingData = booking.toObject();
    return res.status(200).json({
      ...bookingData,
      fieldId: bookingData.field,
      slots: expandBookingSlots(booking)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    await cancelExpiredPendingBookings();
    await completePastPaidBookings();

    const bookings = await Booking.find({ user: new mongoose.Types.ObjectId(req.user.id) })
      .populate('field')
      .sort({ createdAt: -1 });

    const bookingIds = bookings.map((booking) => booking._id);
    const payments = await Payment.find({ bookingId: { $in: bookingIds } }).sort({ createdAt: -1 });
    const reviews = await Review.find({
      user: new mongoose.Types.ObjectId(req.user.id),
      booking: { $in: bookingIds }
    });
    const latestPaymentByBookingId = new Map();
    payments.forEach((payment) => {
      const key = String(payment.bookingId);
      if (!latestPaymentByBookingId.has(key)) latestPaymentByBookingId.set(key, payment);
    });
    const reviewByBookingId = new Map(reviews.map((review) => [String(review.booking), review]));

    return res.json(bookings.map((booking) => {
      const bookingData = booking.toObject();
      const payment = latestPaymentByBookingId.get(String(booking._id)) || null;
      return {
        ...bookingData,
        fieldId: bookingData.field,
        slots: expandBookingSlots(booking),
        payment,
        review: reviewByBookingId.get(String(booking._id)) || null,
        reviewed: Boolean(reviewByBookingId.get(String(booking._id)) || bookingData.reviewed)
      };
    }));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateBookingInfo = async (req, res) => {
  try {
    const { services, totalPrice } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Khong tim thay don!' });
    if (String(booking.user) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Ban khong co quyen cap nhat don nay.' });
    }

    if (Array.isArray(services)) {
      booking.services = services;
      booking.serviceTotal = services.reduce((sum, service) => {
        return sum + (Number(service.price || 0) * Number(service.quantity || 1));
      }, 0);
    }
    if (totalPrice !== undefined) {
      booking.totalPrice = Number(totalPrice);
      booking.subtotal = Math.max(0, Number(totalPrice) - Number(booking.serviceTotal || 0));
    }
    await booking.save();

    return res.json(booking);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Khong tim thay don!' });
    if (String(booking.user) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Ban khong co quyen huy don nay.' });
    }
    if (completedBookingStatuses.includes(booking.status) || cancelledBookingStatuses.includes(booking.status)) {
      return res.status(400).json({ message: 'Booking nay khong the huy.' });
    }

    const startAt = new Date(`${booking.date}T${normalizeTime(booking.startTime)}:00`);
    if (Number.isNaN(startAt.getTime())) {
      return res.status(400).json({ message: 'Thoi gian booking khong hop le.' });
    }

    const twoHoursBeforeStart = startAt.getTime() - (2 * 60 * 60 * 1000);
    if (Date.now() >= twoHoursBeforeStart) {
      return res.status(400).json({ message: 'Chi co the huy truoc gio bat dau toi thieu 2 tieng.' });
    }

    booking.status = 'Cancelled';
    booking.cancelledAt = new Date();
    booking.cancelReason = req.body?.reason || '';
    booking.holdExpiresAt = undefined;
    if (!paidLikePaymentStatuses.includes(booking.paymentStatus)) {
      booking.paymentStatus = 'FAILED';
    }
    await booking.save();

    const latestPayment = await Payment.findOne({ bookingId: booking._id }).sort({ createdAt: -1 });
    if (latestPayment && latestPayment.status === 'PENDING') {
      latestPayment.status = 'CANCELLED';
      await latestPayment.save();
    }

    const io = req.app.get('io');
    if (io) io.emit('booking_cancelled', { bookingId: booking._id, fieldId: booking.field, date: booking.date });

    return res.json({ success: true, booking, payment: latestPayment });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.requestCancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Khong tim thay don!' });
    if (String(booking.user) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Ban khong co quyen huy don nay.' });
    }

    const currentStatus = normalizeStatus(booking.status);
    if (completedStatusSet.includes(currentStatus) || cancelledStatusSet.includes(currentStatus)) {
      return res.status(400).json({ message: 'Booking nay khong the huy.' });
    }
    if (currentStatus === 'cancel_requested') {
      return res.json({ success: true, booking, message: 'Booking dang cho admin xac nhan huy.' });
    }

    const latestPayment = await Payment.findOne({ bookingId: booking._id }).sort({ createdAt: -1 });
    const paid = isPaidBooking(booking, latestPayment);

    booking.status = paid ? 'cancel_requested' : 'cancelled';
    booking.cancelReason = req.body?.reason || '';
    booking.holdExpiresAt = undefined;
    if (!paid) {
      booking.cancelledAt = new Date();
      booking.paymentStatus = 'failed';
      if (latestPayment && latestPayment.status === 'PENDING') {
        latestPayment.status = 'CANCELLED';
        await latestPayment.save();
      }
    }
    await booking.save();

    const io = req.app.get('io');
    if (io) io.emit('booking_cancel_requested', { bookingId: booking._id, fieldId: booking.field, date: booking.date, status: booking.status });

    return res.json({ success: true, booking, payment: latestPayment });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.approveCancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Khong tim thay don!' });
    if (normalizeStatus(booking.status) !== 'cancel_requested') {
      return res.status(400).json({ message: 'Booking khong o trang thai cho xac nhan huy.' });
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.holdExpiresAt = undefined;
    if (req.body?.reason) booking.cancelReason = req.body.reason;
    await booking.save();

    const io = req.app.get('io');
    if (io) io.emit('booking_cancelled', { bookingId: booking._id, fieldId: booking.field, date: booking.date });

    return res.json({ success: true, booking });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.rejectCancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Khong tim thay don!' });
    if (normalizeStatus(booking.status) !== 'cancel_requested') {
      return res.status(400).json({ message: 'Booking khong o trang thai cho xac nhan huy.' });
    }

    booking.status = 'confirmed';
    if (req.body?.reason) booking.cancelReason = req.body.reason;
    await booking.save();

    return res.json({ success: true, booking });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.adminGetBookings = async (req, res) => {
  try {
    await cancelExpiredPendingBookings();
    await completePastPaidBookings();

    const {
      search = '',
      status = '',
      paymentStatus = '',
      paymentMethod = '',
      page = 1,
      limit = 50
    } = req.query;

    const query = {};
    const statusGroups = {
      pending: ['pending', 'Pending', 'PENDING_PAYMENT'],
      confirmed: ['confirmed', 'Confirmed', 'CONFIRMED'],
      completed: ['completed', 'Completed', 'COMPLETED', 'Da hoan thanh', 'ÄÃ£ hoÃ n thÃ nh'],
      cancel_requested: ['cancel_requested'],
      cancelled: ['cancelled', 'Cancelled', 'CANCELLED'],
      refunded: ['refunded']
    };
    const paymentStatusGroups = {
      pending: ['pending', 'Pending', 'PENDING', 'UNPAID'],
      unpaid: ['pending', 'Pending', 'PENDING', 'UNPAID'],
      paid: ['paid', 'success', 'Paid', 'PAID', 'SUCCESS'],
      success: ['paid', 'success', 'Paid', 'PAID', 'SUCCESS'],
      failed: ['failed', 'FAILED'],
      refunded: ['refunded', 'REFUNDED']
    };

    if (status) query.status = { $in: statusGroups[normalizeStatus(status)] || [status] };
    if (paymentStatus) query.paymentStatus = { $in: paymentStatusGroups[normalizeStatus(paymentStatus)] || [paymentStatus] };
    if (paymentMethod) query.paymentMethod = paymentMethod;

    const bookings = await Booking.find(query)
      .populate('user', 'fullName email phone')
      .populate('field', 'fieldName address type')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const bookingIds = bookings.map((booking) => booking._id);
    const payments = await Payment.find({ bookingId: { $in: bookingIds } }).sort({ createdAt: -1 });
    const latestPaymentByBooking = new Map();
    payments.forEach((payment) => {
      const key = String(payment.bookingId);
      if (!latestPaymentByBooking.has(key)) latestPaymentByBooking.set(key, payment);
    });

    const normalizedSearch = String(search).trim().toLowerCase();
    const rows = bookings
      .map((booking) => {
        const bookingData = booking.toObject();
        const payment = latestPaymentByBooking.get(String(booking._id)) || null;
        return {
          ...bookingData,
          fieldId: bookingData.field,
          userId: bookingData.user,
          payment
        };
      })
      .filter((booking) => {
        if (!normalizedSearch) return true;
        const haystack = [
          booking._id,
          booking.user?.fullName,
          booking.user?.email,
          booking.user?.phone,
          booking.userId?.fullName,
          booking.userId?.email,
          booking.userId?.phone,
          booking.payment?.txnRef,
          booking.payment?.transactionNo
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(normalizedSearch);
      });

    return res.json({ bookings: rows, total: rows.length });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
