// File: Backend/controllers/userFieldController.js
const Field = require('../models/Field');
const Review = require('../models/Review'); 
const Booking = require('../models/Booking');

const normalizeTime = (time) => {
  const [hour, minute] = String(time).split(':').map(Number);
  return `${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;
};

const addMinutes = (time, minutesToAdd) => {
  const [hour, minute] = normalizeTime(time).split(':').map(Number);
  const totalMinutes = hour * 60 + minute + minutesToAdd;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
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

const getScheduleSlots = (pricingRules = []) => {
  const validRules = pricingRules.filter((rule) => rule?.startTime && rule?.endTime);
  const startTime = validRules.length
    ? validRules.map((rule) => normalizeTime(rule.startTime)).sort()[0]
    : '05:00';
  const endTime = validRules.length
    ? validRules.map((rule) => normalizeTime(rule.endTime)).sort().at(-1)
    : '24:00';

  const slots = [];
  let current = startTime;
  while (current < endTime) {
    slots.push(current);
    current = addMinutes(current, 30);
  }
  return slots;
};

const todayString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const activeBookingStatuses = ['confirmed', 'Confirmed', 'CONFIRMED', 'PENDING_PAYMENT', 'cancel_requested'];
const pendingPaymentStatuses = ['pending', 'Pending', 'PENDING', 'UNPAID'];
const lockedPaymentStatuses = ['paid', 'success', 'Paid', 'PAID', 'deposit', 'unpaid', 'UNPAID'];
const getActivePendingHoldQuery = () => ({
  $or: [
    { holdExpiresAt: { $gt: new Date() } },
    { holdExpiresAt: { $exists: false }, createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) } }
  ]
});
const getBlockingBookingPaymentQuery = () => ({
  $or: [
    { paymentStatus: { $in: lockedPaymentStatuses } },
    { paymentStatus: { $in: pendingPaymentStatuses }, ...getActivePendingHoldQuery() }
  ]
});

// =========================================================================
// 1. [GET] LẤY DANH SÁCH SÂN CHO NGƯỜI DÙNG (CÓ ĐỒNG BỘ BẢNG GIÁ)
// =========================================================================
exports.userGetFields = async (req, res) => {
  try {
    const { isFeatured, type } = req.query;
    let query = {};
    
    if (isFeatured) query.isFeatured = isFeatured === 'true';
    if (type) query.type = type;

    const fields = await Field.find(query).populate('pricingRules');
    const date = req.query.date || todayString();
    const fieldIds = fields.map((field) => field._id);
    const bookings = await Booking.find({
      field: { $in: fieldIds },
      date,
      status: { $in: activeBookingStatuses },
      ...getBlockingBookingPaymentQuery()
    });

    const bookedSlotsByField = new Map();
    bookings.forEach((booking) => {
      const key = String(booking.field);
      if (!bookedSlotsByField.has(key)) bookedSlotsByField.set(key, new Set());
      expandBookingSlots(booking).forEach((slot) => bookedSlotsByField.get(key).add(slot));
    });

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const response = fields.map((field) => {
      const fieldData = field.toObject();
      if (field.status === 'Maintenance') {
        return { ...fieldData, availabilityStatus: 'maintenance', availableSlotsToday: 0 };
      }

      const bookedSlots = bookedSlotsByField.get(String(field._id)) || new Set();
      const availableSlots = getScheduleSlots(field.pricingRules).filter((slot) => {
        const [hour, minute] = slot.split(':').map(Number);
        const isPastToday = date === todayString() && (hour * 60 + minute) <= nowMinutes;
        return !isPastToday && !bookedSlots.has(slot);
      });

      return {
        ...fieldData,
        availabilityStatus: availableSlots.length > 0 ? 'available' : 'full',
        availableSlotsToday: availableSlots.length
      };
    });

    res.json(response);
  } catch (error) {
    console.error("❌ Lỗi tại userFieldController -> userGetFields:", error.message);
    res.status(500).json({ message: "Lỗi lấy danh sách sân từ hệ thống" });
  }
};

// =========================================================================
// 2. [GET] LẤY CHI TIẾT 1 SÂN CHO TRANG DETAIL & ĐẶT LỊCH (BOOKING PAGE)
// =========================================================================
exports.userGetFieldById = async (req, res) => {
  try {
    const { id } = req.params;

    const field = await Field.findById(id).populate('pricingRules');
    
    if (!field) {
      return res.status(404).json({ message: "Không tìm thấy sân bóng yêu cầu!" });
    }
    
    const reviews = await Review.find({ field: id, isHidden: { $ne: true } })
      .populate('user', 'fullName email avatar')
      .sort({ createdAt: -1 });
    
    return res.json({ field, reviews });
  } catch (error) {
    console.error("❌ Lỗi tại userFieldController -> userGetFieldById:", error.message);
    return res.status(500).json({ message: "Lỗi lấy chi tiết tài nguyên sân" });
  }
};
