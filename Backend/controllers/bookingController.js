const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Field = require('../models/Field');
const cron = require('node-cron');

const normalizeTime = (time) => {
  const [hour, minute] = String(time).split(':').map(Number);
  return `${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;
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

cron.schedule('* * * * *', async () => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const expiredBookings = await Booking.find({
      paymentStatus: 'Pending',
      status: 'Confirmed',
      createdAt: { $lte: fiveMinutesAgo }
    });

    for (const booking of expiredBookings) {
      booking.status = 'Cancelled';
      await booking.save();
    }
  } catch (error) {
    console.error('Loi Cron Job:', error.message);
  }
});

exports.getBookingStatus = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { date } = req.query;

    const field = await Field.findById(fieldId);
    if (!field) return res.status(404).json({ message: 'Khong tim thay san!' });

    const queryDateStr = date || new Date().toISOString().split('T')[0];
    const bookings = await Booking.find({
      field: new mongoose.Types.ObjectId(fieldId),
      date: String(queryDateStr).trim(),
      status: 'Confirmed'
    });

    const bookedSlots = [];
    bookings.forEach((booking) => {
      const isExpiredPending =
        booking.paymentStatus === 'Pending' &&
        new Date() - new Date(booking.createdAt) > 5 * 60 * 1000;

      if (!isExpiredPending && booking.startTime && booking.endTime) {
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

    const selectedSlots = [...new Set(slots.map(normalizeTime))].sort();
    const startTime = selectedSlots[0];
    const endTime = addMinutes(selectedSlots[selectedSlots.length - 1], 30);

    const field = await Field.findById(fieldId);
    if (!field) return res.status(404).json({ success: false, message: 'Khong tim thay san!' });

    const selectedDateObj = new Date(date);
    const dayOfWeek = selectedDateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const totalPrice = selectedSlots.reduce((total, slotTime) => {
      const hour = parseInt(slotTime.split(':')[0], 10);
      const rule = field.pricingRules.find((pricingRule) => {
        const startHour = parseInt(pricingRule.startTime.split(':')[0], 10);
        const endHour = parseInt(pricingRule.endTime.split(':')[0], 10);
        const matchDay = isWeekend ? pricingRule.dayType === 'Weekend' : pricingRule.dayType === 'Weekday';
        return matchDay && hour >= startHour && hour < endHour;
      });

      return total + (rule ? rule.price / 2 : 50000);
    }, 0);

    const confirmedBookings = await Booking.find({
      field: new mongoose.Types.ObjectId(fieldId),
      date,
      status: 'Confirmed'
    });

    const bookedSlots = new Set();
    confirmedBookings.forEach((booking) => {
      expandBookingSlots(booking).forEach((slot) => bookedSlots.add(slot));
    });

    const hasConflict = selectedSlots.some((slot) => bookedSlots.has(slot));
    if (hasConflict) {
      return res.status(400).json({ success: false, message: 'Khung gio nay da co nguoi dat!' });
    }

    const newBooking = await Booking.create({
      user: new mongoose.Types.ObjectId(req.user.id),
      field: new mongoose.Types.ObjectId(fieldId),
      date,
      startTime,
      endTime,
      totalPrice,
      paymentStatus: 'Pending',
      status: 'Confirmed'
    });

    if (req.io) req.io.emit('slot_booked_success', { fieldId, date, slots: selectedSlots });
    return res.status(200).json({ success: true, bookingId: newBooking._id });
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
