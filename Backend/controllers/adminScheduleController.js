const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Field = require('../models/Field');
const RecurringBooking = require('../models/RecurringBooking');
const { createNotification } = require('../services/notificationService');
const { emitToAdmin, emitToUser } = require('../utils/socket');

const ACTIVE_CONFLICT_STATUSES = { $nin: ['cancelled', 'Cancelled', 'CANCELLED', 'rejected', 'Rejected', 'REJECTED'] };
const LOCKED_STATUSES = ['cancelled', 'completed', 'Cancelled', 'Completed', 'CANCELLED', 'COMPLETED', 'Da hoan thanh', 'ÄÃ£ hoÃ n thÃ nh'];
const DAY_NAMES = ['Chu nhat', 'Thu 2', 'Thu 3', 'Thu 4', 'Thu 5', 'Thu 6', 'Thu 7'];

const normalizeDate = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const normalizeTime = (value) => {
  const [hour, minute] = String(value || '').split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const timeToMinutes = (value) => {
  const time = normalizeTime(value);
  if (!time) return NaN;
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

const formatMoney = (amount) => Number(amount || 0).toLocaleString('vi-VN');

const getCustomerName = (booking) => (
  booking.customerName ||
  booking.user?.fullName ||
  booking.user?.name ||
  booking.user?.email ||
  'Khach hang'
);

const getCustomerPhone = (booking) => booking.customerPhone || booking.user?.phone || '';

const validateTimeRange = (startTime, endTime) => {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (Number.isNaN(start) || Number.isNaN(end)) return 'Thoi gian khong hop le';
  if (start >= end) return 'Gio bat dau phai nho hon gio ket thuc';
  if (end - start < 30) return 'Thoi luong toi thieu la 30 phut';
  if (start < 300 || end > 1380) return 'Chi duoc dat san trong khung 05:00 - 23:00';
  return '';
};

const getSlots = (startDate, endDate, daysOfWeek, startTime, endTime) => {
  const slots = [];
  const cursor = new Date(`${normalizeDate(startDate)}T00:00:00`);
  const last = new Date(`${normalizeDate(endDate)}T00:00:00`);
  while (cursor <= last) {
    const day = cursor.getDay();
    if (daysOfWeek.includes(day)) {
      slots.push({
        date: cursor.toISOString().slice(0, 10),
        dayOfWeek: day,
        startTime,
        endTime
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots;
};

const findConflict = async ({ courtId, date, startTime, endTime, excludeBookingId, excludeBookingIds = [] }) => {
  const query = {
    field: new mongoose.Types.ObjectId(courtId),
    date: normalizeDate(date),
    status: ACTIVE_CONFLICT_STATUSES,
    startTime: { $lt: normalizeTime(endTime) },
    endTime: { $gt: normalizeTime(startTime) }
  };
  const excludedIds = [...excludeBookingIds, excludeBookingId]
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(id));
  if (excludedIds.length > 0) query._id = { $nin: excludedIds };
  return Booking.findOne(query).populate('user', 'fullName phone email');
};

const checkRecurringSlots = async ({ courtId, startDate, endDate, daysOfWeek, startTime, endTime, excludeBookingIds = [] }) => {
  const slots = getSlots(startDate, endDate, daysOfWeek, startTime, endTime);
  const checkedSlots = [];
  for (const slot of slots) {
    const conflict = await findConflict({
      courtId,
      date: slot.date,
      startTime,
      endTime,
      excludeBookingIds
    });
    checkedSlots.push({
      ...slot,
      isAvailable: !conflict,
      conflictBookingId: conflict?._id || null,
      conflictCustomerName: conflict ? getCustomerName(conflict) : ''
    });
  }
  return {
    totalSlots: checkedSlots.length,
    availableSlots: checkedSlots.filter((slot) => slot.isAvailable).length,
    conflictSlots: checkedSlots.filter((slot) => !slot.isAvailable).length,
    slots: checkedSlots
  };
};

const buildEvent = (booking) => {
  const date = normalizeDate(booking.date);
  const customerName = getCustomerName(booking);
  return {
    id: String(booking._id),
    resourceId: String(booking.field?._id || booking.field),
    title: customerName,
    start: `${date}T${normalizeTime(booking.startTime)}:00`,
    end: `${date}T${normalizeTime(booking.endTime)}:00`,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    customerName,
    customerPhone: getCustomerPhone(booking),
    totalPrice: booking.totalPrice,
    isRecurring: Boolean(booking.isRecurring),
    recurringGroupId: booking.recurringGroupId,
    recurringInfo: booking.recurringInfo,
    services: booking.services || [],
    note: booking.note || '',
    rescheduleHistory: booking.rescheduleHistory || [],
    extendedProps: {
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      customerName,
      customerPhone: getCustomerPhone(booking),
      totalPrice: booking.totalPrice,
      isRecurring: Boolean(booking.isRecurring),
      recurringGroupId: booking.recurringGroupId,
      recurringInfo: booking.recurringInfo,
      services: booking.services || [],
      note: booking.note || '',
      rescheduleHistory: booking.rescheduleHistory || [],
      fieldName: booking.field?.fieldName || ''
    }
  };
};

exports.getSchedule = async (req, res) => {
  try {
    const { date, sportType, search } = req.query;
    const selectedDate = normalizeDate(date);
    const fieldQuery = {};
    if (sportType && sportType !== 'all') fieldQuery.type = sportType;

    const fields = await Field.find(fieldQuery).sort({ type: 1, fieldName: 1 });
    const fieldIds = fields.map((field) => field._id);
    const bookingQuery = { field: { $in: fieldIds }, date: selectedDate };

    const bookings = await Booking.find(bookingQuery)
      .populate('user', 'fullName phone email')
      .populate('field', 'fieldName type address')
      .sort({ startTime: 1 });

    const keyword = String(search || '').trim().toLowerCase();
    const filteredBookings = keyword
      ? bookings.filter((booking) => [
        booking._id,
        getCustomerName(booking),
        getCustomerPhone(booking),
        booking.user?.email
      ].filter(Boolean).join(' ').toLowerCase().includes(keyword))
      : bookings;

    return res.json({
      resources: fields.map((field) => ({
        id: String(field._id),
        title: field.fieldName,
        fieldName: field.fieldName,
        sportType: field.type,
        address: field.address,
        image: field.image,
        gallery: field.gallery
      })),
      events: filteredBookings.map(buildEvent)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.rescheduleBooking = async (req, res) => {
  try {
    const { newCourtId, newDate, newStartTime, newEndTime, reason } = req.body;
    const booking = await Booking.findById(req.params.id).populate('user', 'fullName phone email');
    if (!booking) return res.status(404).json({ message: 'Khong tim thay booking' });
    if (LOCKED_STATUSES.includes(booking.status)) return res.status(400).json({ message: 'Booking nay khong the doi lich' });

    const timeError = validateTimeRange(newStartTime, newEndTime);
    if (timeError) return res.status(400).json({ message: timeError });

    const field = await Field.findById(newCourtId);
    if (!field) return res.status(404).json({ message: 'Khong tim thay san moi' });

    const conflict = await findConflict({
      courtId: newCourtId,
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      excludeBookingId: booking._id
    });
    if (conflict) return res.status(400).json({ message: 'Khung gio nay da co nguoi dat' });

    const oldCourt = booking.field;
    const oldDate = booking.date;
    const oldStartTime = booking.startTime;
    const oldEndTime = booking.endTime;

    booking.field = newCourtId;
    booking.date = normalizeDate(newDate);
    booking.startTime = normalizeTime(newStartTime);
    booking.endTime = normalizeTime(newEndTime);
    booking.rescheduleHistory.push({
      oldCourt,
      newCourt: newCourtId,
      oldDate,
      newDate: normalizeDate(newDate),
      oldStartTime,
      oldEndTime,
      newStartTime: normalizeTime(newStartTime),
      newEndTime: normalizeTime(newEndTime),
      changedBy: req.user.id,
      reason
    });
    await booking.save();

    let notification = null;
    if (booking.user) {
      notification = await createNotification({
        user: booking.user._id || booking.user,
        title: 'Lich dat san da duoc thay doi',
        message: `Lich dat san cua ban da duoc chuyen sang ${field.fieldName} luc ${booking.startTime} - ${booking.endTime} ngay ${booking.date}.`,
        type: 'booking',
        relatedId: booking._id,
        relatedModel: 'Booking'
      });
      emitToUser(booking.user._id || booking.user, 'booking:rescheduled', { bookingId: booking._id, booking });
    }
    emitToAdmin('schedule:refresh', { message: 'Lich san da duoc cap nhat' });

    return res.json({ booking, notification });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.checkRecurringBooking = async (req, res) => {
  try {
    const { courtId, startDate, endDate, daysOfWeek = [], startTime, endTime } = req.body;
    if (!courtId || !startDate || !endDate || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return res.status(400).json({ message: 'Thieu thong tin lich co dinh' });
    }
    if (normalizeDate(startDate) > normalizeDate(endDate)) return res.status(400).json({ message: 'Ngay bat dau phai truoc ngay ket thuc' });
    const timeError = validateTimeRange(startTime, endTime);
    if (timeError) return res.status(400).json({ message: timeError });
    const result = await checkRecurringSlots({
      courtId,
      startDate,
      endDate,
      daysOfWeek: daysOfWeek.map(Number),
      startTime: normalizeTime(startTime),
      endTime: normalizeTime(endTime)
    });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.createRecurringBooking = async (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerPhone,
      courtId,
      startDate,
      endDate,
      daysOfWeek = [],
      startTime,
      endTime,
      note,
      paymentStatus = 'unpaid',
      createOnlyAvailableSlots = false
    } = req.body;

    if (!customerId && (!customerName || !customerPhone)) return res.status(400).json({ message: 'Vui long nhap thong tin khach hang' });
    const field = await Field.findById(courtId);
    if (!field) return res.status(404).json({ message: 'Khong tim thay san' });
    if (normalizeDate(startDate) > normalizeDate(endDate)) return res.status(400).json({ message: 'Ngay bat dau phai truoc ngay ket thuc' });
    const timeError = validateTimeRange(startTime, endTime);
    if (timeError) return res.status(400).json({ message: timeError });

    const checked = await checkRecurringSlots({
      courtId,
      startDate,
      endDate,
      daysOfWeek: daysOfWeek.map(Number),
      startTime: normalizeTime(startTime),
      endTime: normalizeTime(endTime)
    });
    if (checked.conflictSlots > 0 && !createOnlyAvailableSlots) {
      return res.status(409).json({ message: 'Co lich bi trung', conflictSlots: checked.slots.filter((slot) => !slot.isAvailable) });
    }

    const recurringGroupId = `REC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const recurringBooking = await RecurringBooking.create({
      customer: customerId || null,
      customerName,
      customerPhone,
      court: courtId,
      startDate: normalizeDate(startDate),
      endDate: normalizeDate(endDate),
      daysOfWeek: daysOfWeek.map(Number),
      startTime: normalizeTime(startTime),
      endTime: normalizeTime(endTime),
      note,
      paymentStatus,
      createdBy: req.user.id
    });

    const availableSlots = checked.slots.filter((slot) => slot.isAvailable);
    const bookings = await Booking.insertMany(availableSlots.map((slot) => ({
      user: customerId || null,
      customerName,
      customerPhone,
      field: courtId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: 'confirmed',
      paymentStatus,
      totalPrice: 0,
      originalAmount: 0,
      subtotal: 0,
      finalAmount: 0,
      isRecurring: true,
      recurringGroupId,
      recurringInfo: {
        startDate: normalizeDate(startDate),
        endDate: normalizeDate(endDate),
        daysOfWeek: daysOfWeek.map(Number),
        startTime: normalizeTime(startTime),
        endTime: normalizeTime(endTime),
        createdBy: req.user.id
      },
      note
    })));

    recurringBooking.bookingIds = bookings.map((booking) => booking._id);
    await recurringBooking.save();

    let notification = null;
    if (customerId) {
      notification = await createNotification({
        user: customerId,
        title: 'Lich dat san co dinh da duoc tao',
        message: `Ban da duoc dat lich co dinh vao ${daysOfWeek.map((day) => DAY_NAMES[day]).join(', ')} luc ${normalizeTime(startTime)} - ${normalizeTime(endTime)} tu ${normalizeDate(startDate)} den ${normalizeDate(endDate)}.`,
        type: 'booking',
        relatedId: recurringBooking._id,
        relatedModel: 'RecurringBooking'
      });
      emitToUser(customerId, 'booking:recurring-created', { recurringBooking, createdCount: bookings.length });
    }
    emitToAdmin('schedule:refresh', { message: 'Lich co dinh da duoc tao' });

    return res.status(201).json({
      message: 'Tao lich co dinh thanh cong',
      recurringBooking,
      createdCount: bookings.length,
      skippedCount: checked.conflictSlots,
      conflictSlots: checked.slots.filter((slot) => !slot.isAvailable),
      notification
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.listRecurringBookings = async (req, res) => {
  try {
    const { status, search, courtId, fromDate, toDate } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (courtId) query.court = courtId;
    if (fromDate || toDate) {
      query.endDate = {};
      if (fromDate) query.endDate.$gte = normalizeDate(fromDate);
      if (toDate) query.startDate = { $lte: normalizeDate(toDate) };
    }
    const rows = await RecurringBooking.find(query)
      .populate('customer', 'fullName phone email')
      .populate('court', 'fieldName type')
      .sort({ createdAt: -1 });
    const keyword = String(search || '').trim().toLowerCase();
    const filtered = keyword
      ? rows.filter((item) => [
        item.customerName,
        item.customerPhone,
        item.customer?.fullName,
        item.customer?.phone,
        item.court?.fieldName
      ].filter(Boolean).join(' ').toLowerCase().includes(keyword))
      : rows;
    return res.json({ recurringBookings: filtered });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getRecurringBookingDetail = async (req, res) => {
  try {
    const recurringBooking = await RecurringBooking.findById(req.params.id)
      .populate('customer', 'fullName phone email')
      .populate('court', 'fieldName type')
      .populate({ path: 'bookingIds', populate: { path: 'field user', select: 'fieldName type fullName phone email' } });
    if (!recurringBooking) return res.status(404).json({ message: 'Khong tim thay lich co dinh' });
    const bookings = recurringBooking.bookingIds || [];
    const now = new Date();
    return res.json({
      recurringBooking,
      stats: {
        totalBookings: bookings.length,
        completedCount: bookings.filter((booking) => String(booking.status).toLowerCase().includes('completed')).length,
        upcomingCount: bookings.filter((booking) => new Date(`${booking.date}T${booking.startTime}:00`) >= now).length,
        cancelledCount: bookings.filter((booking) => String(booking.status).toLowerCase().includes('cancelled')).length
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.cancelRecurringBooking = async (req, res) => {
  try {
    const recurringBooking = await RecurringBooking.findById(req.params.id);
    if (!recurringBooking) return res.status(404).json({ message: 'Khong tim thay lich co dinh' });
    const nowDate = new Date().toISOString().slice(0, 10);
    await Booking.updateMany({
      _id: { $in: recurringBooking.bookingIds },
      date: { $gte: nowDate },
      status: { $nin: ['completed', 'Completed', 'COMPLETED'] }
    }, {
      $set: { status: 'cancelled', cancelReason: req.body.reason || 'Admin huy lich co dinh', cancelledAt: new Date() }
    });
    recurringBooking.status = 'cancelled';
    recurringBooking.cancelledBy = req.user.id;
    recurringBooking.cancelledAt = new Date();
    recurringBooking.cancelReason = req.body.reason || '';
    await recurringBooking.save();

    if (recurringBooking.customer) {
      await createNotification({
        user: recurringBooking.customer,
        title: 'Lich dat san co dinh da bi huy',
        message: 'Lich dat san co dinh cua ban da duoc huy boi admin.',
        type: 'booking',
        relatedId: recurringBooking._id,
        relatedModel: 'RecurringBooking'
      });
    }
    emitToAdmin('schedule:refresh', { message: 'Lich co dinh da bi huy' });
    return res.json({ recurringBooking });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.updateFutureRecurringBooking = async (req, res) => {
  try {
    const {
      newCourtId,
      newStartDate,
      newEndDate,
      newDaysOfWeek = [],
      newStartTime,
      newEndTime,
      reason
    } = req.body;
    const recurringBooking = await RecurringBooking.findById(req.params.id);
    if (!recurringBooking) return res.status(404).json({ message: 'Khong tim thay lich co dinh' });
    const timeError = validateTimeRange(newStartTime, newEndTime);
    if (timeError) return res.status(400).json({ message: timeError });

    const checked = await checkRecurringSlots({
      courtId: newCourtId,
      startDate: newStartDate,
      endDate: newEndDate,
      daysOfWeek: newDaysOfWeek.map(Number),
      startTime: normalizeTime(newStartTime),
      endTime: normalizeTime(newEndTime),
      excludeBookingIds: recurringBooking.bookingIds
    });
    if (checked.conflictSlots > 0) {
      return res.status(409).json({ message: 'Co lich bi trung', conflictSlots: checked.slots.filter((slot) => !slot.isAvailable) });
    }

    const today = new Date().toISOString().slice(0, 10);
    await Booking.updateMany({
      _id: { $in: recurringBooking.bookingIds },
      date: { $gte: today },
      status: { $nin: ['completed', 'Completed', 'COMPLETED'] }
    }, { $set: { status: 'cancelled', cancelReason: reason || 'Cap nhat lich co dinh' } });

    const bookings = await Booking.insertMany(checked.slots.map((slot) => ({
      user: recurringBooking.customer || null,
      customerName: recurringBooking.customerName,
      customerPhone: recurringBooking.customerPhone,
      field: newCourtId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: 'confirmed',
      paymentStatus: recurringBooking.paymentStatus,
      totalPrice: 0,
      isRecurring: true,
      recurringGroupId: String(recurringBooking._id),
      recurringInfo: {
        startDate: normalizeDate(newStartDate),
        endDate: normalizeDate(newEndDate),
        daysOfWeek: newDaysOfWeek.map(Number),
        startTime: normalizeTime(newStartTime),
        endTime: normalizeTime(newEndTime),
        createdBy: req.user.id
      },
      note: recurringBooking.note
    })));

    recurringBooking.updateHistory.push({
      oldCourt: recurringBooking.court,
      newCourt: newCourtId,
      oldStartDate: recurringBooking.startDate,
      oldEndDate: recurringBooking.endDate,
      newStartDate: normalizeDate(newStartDate),
      newEndDate: normalizeDate(newEndDate),
      oldDaysOfWeek: recurringBooking.daysOfWeek,
      newDaysOfWeek: newDaysOfWeek.map(Number),
      oldStartTime: recurringBooking.startTime,
      oldEndTime: recurringBooking.endTime,
      newStartTime: normalizeTime(newStartTime),
      newEndTime: normalizeTime(newEndTime),
      updatedBy: req.user.id,
      reason
    });
    recurringBooking.court = newCourtId;
    recurringBooking.startDate = normalizeDate(newStartDate);
    recurringBooking.endDate = normalizeDate(newEndDate);
    recurringBooking.daysOfWeek = newDaysOfWeek.map(Number);
    recurringBooking.startTime = normalizeTime(newStartTime);
    recurringBooking.endTime = normalizeTime(newEndTime);
    recurringBooking.bookingIds.push(...bookings.map((booking) => booking._id));
    await recurringBooking.save();

    if (recurringBooking.customer) {
      await createNotification({
        user: recurringBooking.customer,
        title: 'Lich dat san co dinh da duoc cap nhat',
        message: `Lich co dinh cua ban da duoc cap nhat. Tong gia tri lich: ${formatMoney(recurringBooking.totalPrice)} VND.`,
        type: 'booking',
        relatedId: recurringBooking._id,
        relatedModel: 'RecurringBooking'
      });
    }
    emitToAdmin('schedule:refresh', { message: 'Lich co dinh da duoc cap nhat' });
    return res.json({ recurringBooking, createdCount: bookings.length });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};
