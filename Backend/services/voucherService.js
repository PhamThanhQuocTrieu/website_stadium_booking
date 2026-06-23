const mongoose = require('mongoose');
const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const { createNotification } = require('./notificationService');

const WELCOME_VOUCHER_CODE = 'WELCOME20';
const WELCOME_VOUCHER_LINK = '/my-vouchers';
const WELCOME_VOUCHER_TITLE = 'Bạn có voucher mới';
const WELCOME_VOUCHER_MESSAGE = 'Bạn vừa nhận voucher WELCOME20 - Giảm 20% cho lần đặt sân đầu tiên.';

const successfulBookingStatuses = ['paid', 'confirmed', 'completed'];
const successfulPaymentStatuses = ['paid', 'success'];
const unfinishedPaymentStatuses = ['pending', 'unpaid', 'failed', 'cancelled', 'refunded'];
const statusVariants = (statuses) => statuses.flatMap((status) => [
  status,
  status.toUpperCase(),
  status[0].toUpperCase() + status.slice(1)
]);

const successfulBookingQuery = (userId, extra = {}) => ({
  user: userId,
  ...extra,
  paymentStatus: { $nin: statusVariants(unfinishedPaymentStatuses) },
  $or: [
    { paymentStatus: { $in: statusVariants(successfulPaymentStatuses) } },
    { status: { $in: statusVariants(successfulBookingStatuses) } }
  ]
});

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
const normalizeTime = (time) => {
  const [hour = 0, minute = 0] = String(time || '00:00').split(':').map(Number);
  return `${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;
};
const timeToMinutes = (time) => {
  const [hour, minute] = normalizeTime(time).split(':').map(Number);
  return hour * 60 + minute;
};
const getBookingDay = (bookingDate) => {
  if (!bookingDate) return null;
  const dateValue = String(bookingDate).trim();
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateMatch
    ? new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
    : new Date(bookingDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDay();
};
const isWeekendBooking = (bookingDate) => {
  const day = getBookingDay(bookingDate);
  return day === 0 || day === 6;
};
const objectIdSet = (ids = []) => new Set(ids.filter(Boolean).map((id) => String(id)));

const getDiscountValue = (voucher) => Number(
  voucher.discountValue !== undefined && voucher.discountValue !== null
    ? voucher.discountValue
    : voucher.discountPercent || 0
);

const getMinOrderAmount = (voucher) => Number(
  voucher.minOrderAmount !== undefined && voucher.minOrderAmount !== null
    ? voucher.minOrderAmount
    : voucher.minOrderValue || 0
);

const getUsedCount = (voucher) => Number(
  voucher.usedCount !== undefined && voucher.usedCount !== null
    ? voucher.usedCount
    : voucher.usageCount || 0
);

const getFieldIds = (voucher) => {
  const ids = voucher.fieldIds?.length ? voucher.fieldIds : voucher.applicableFields;
  return objectIdSet(ids || []);
};

const getPublicStatus = (voucher) => {
  const now = new Date();
  const status = normalizeStatus(voucher.status);
  if (voucher.endDate && new Date(voucher.endDate) < now) return 'expired';
  if (voucher.startDate && new Date(voucher.startDate) > now && status === 'active') return 'pending';
  if (status === 'active' || status === 'inactive' || status === 'draft') return status;
  if (status === 'expired' || status === 'pending') return status;
  return status === 'active' ? 'active' : status;
};

const getActiveWelcomeVoucher = () => {
  const now = new Date();
  return Voucher.findOne({
    code: WELCOME_VOUCHER_CODE,
    applyType: 'new_user',
    autoAssignNewUser: true,
    status: { $in: ['active', 'Active'] },
    startDate: { $lte: now },
    endDate: { $gte: now }
  });
};

const ensureWelcomeVoucher = async () => {
  const existingVoucher = await Voucher.findOne({ code: WELCOME_VOUCHER_CODE });
  if (existingVoucher) return existingVoucher;

  const now = new Date();
  const endDate = new Date(now);
  endDate.setFullYear(endDate.getFullYear() + 1);

  return Voucher.create({
    code: WELCOME_VOUCHER_CODE,
    name: 'Ưu đãi khách hàng mới',
    discountType: 'percent',
    discountValue: 20,
    discountPercent: 20,
    maxDiscount: 50000,
    minOrderAmount: 100000,
    minOrderValue: 100000,
    usageLimit: 999999,
    usedCount: 0,
    usageCount: 0,
    perUserLimit: 1,
    applyType: 'new_user',
    autoAssignNewUser: true,
    status: 'active',
    startDate: now,
    endDate
  });
};

const normalizeVoucherPayload = (body = {}) => {
  const applyType = body.applyType || 'all';
  const discountType = body.discountType || 'percent';
  const discountValue = Number(body.discountValue ?? body.discountPercent ?? 0);
  const minOrderAmount = Number(body.minOrderAmount ?? body.minOrderValue ?? 0);
  const usedCount = Number(body.usedCount ?? body.usageCount ?? 0);
  const fieldIds = (applyType === 'field' ? (body.fieldIds || body.applicableFields || []) : [])
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  return {
    ...body,
    code: String(body.code || '').trim().toUpperCase(),
    discountType,
    discountValue,
    discountPercent: discountType === 'percent' ? discountValue : Number(body.discountPercent || 0),
    minOrderAmount,
    minOrderValue: minOrderAmount,
    usedCount,
    usageCount: usedCount,
    fieldIds,
    applicableFields: fieldIds,
    usageLimit: Number(body.usageLimit || 0) || 100,
    perUserLimit: Number(body.perUserLimit || 1),
    maxDiscount: Number(body.maxDiscount || 0),
    applyType,
    sportTypes: body.sportTypes || [],
    validDays: (body.validDays || []).map(Number),
    autoAssignNewUser: Boolean(body.autoAssignNewUser) && applyType === 'new_user',
    status: normalizeStatus(body.status || 'active')
  };
};

const validateVoucherPayload = (payload) => {
  if (payload.applyType === 'field' && (!Array.isArray(payload.fieldIds) || payload.fieldIds.length === 0)) {
    throw makeError('Vui lòng chọn ít nhất một sân áp dụng.');
  }
};

const serializeVoucher = (voucher) => {
  const doc = voucher?.toObject ? voucher.toObject() : voucher;
  if (!doc) return doc;
  const discountValue = getDiscountValue(doc);
  const minOrderAmount = getMinOrderAmount(doc);
  const usedCount = getUsedCount(doc);
  const fieldIds = doc.fieldIds?.length ? doc.fieldIds : doc.applicableFields || [];

  return {
    ...doc,
    discountValue,
    discountPercent: doc.discountPercent ?? (doc.discountType === 'percent' ? discountValue : 0),
    minOrderAmount,
    minOrderValue: doc.minOrderValue ?? minOrderAmount,
    usedCount,
    usageCount: doc.usageCount ?? usedCount,
    fieldIds,
    applicableFields: doc.applicableFields?.length ? doc.applicableFields : fieldIds,
    status: getPublicStatus(doc)
  };
};

const makeError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateVoucherForBooking = async ({
  userId,
  code,
  fieldId,
  sportType,
  bookingDate,
  startTime,
  endTime,
  originalAmount
}) => {
  if (!userId) throw makeError('Vui long dang nhap de su dung ma giam gia.', 401);
  if (!code) throw makeError('Vui long nhap ma giam gia.');

  const voucher = await Voucher.findOne({ code: String(code).trim().toUpperCase() });
  if (!voucher) throw makeError('Ma khong ton tai.', 404);

  const publicStatus = getPublicStatus(voucher);
  const now = new Date();
  if (publicStatus !== 'active') {
    if (publicStatus === 'expired' || new Date(voucher.endDate) < now) throw makeError('Ma da het han.');
    throw makeError('Ma giam gia chua kha dung.');
  }
  if (new Date(voucher.startDate) > now || new Date(voucher.endDate) < now) {
    throw makeError(new Date(voucher.endDate) < now ? 'Ma da het han.' : 'Ma giam gia chua den ngay su dung.');
  }
  if (getUsedCount(voucher) >= Number(voucher.usageLimit || 0)) {
    throw makeError('Ma da het luot su dung.');
  }

  const amount = Number(originalAmount || 0);
  const minOrderAmount = getMinOrderAmount(voucher);
  if (amount < minOrderAmount) {
    throw makeError('Đơn hàng chưa đạt giá trị tối thiểu để dùng mã.');
  }

  const userVoucher = await UserVoucher.findOne({ userId, voucherId: voucher._id });
  if (voucher.applyType === 'new_user' && voucher.autoAssignNewUser) {
    if (!userVoucher) {
      throw makeError('Bạn chưa được cấp mã giảm giá này.');
    }
    if (userVoucher.status !== 'available') {
      throw makeError(userVoucher.status === 'expired' ? 'Mã giảm giá đã hết hạn.' : 'Mã giảm giá đã được sử dụng.');
    }
  } else if (userVoucher && userVoucher.status !== 'available') {
    throw makeError(userVoucher.status === 'expired' ? 'Ma da het han.' : 'Ma nay da duoc su dung.');
  }
  if (userVoucher && new Date(voucher.endDate) < now) {
    userVoucher.status = 'expired';
    await userVoucher.save();
    throw makeError('Ma da het han.');
  }

  const usedByUser = await Booking.countDocuments(successfulBookingQuery(userId, { voucherId: voucher._id }));
  if (usedByUser >= Number(voucher.perUserLimit || 1)) {
    throw makeError('Ban da su dung qua so lan cho phep cua ma nay.');
  }

  const applyType = voucher.applyType || 'all';
  if (applyType === 'new_user') {
    const successfulBooking = await Booking.exists(successfulBookingQuery(userId));
    if (successfulBooking) throw makeError('Mã giảm giá chỉ áp dụng cho lần đặt sân đầu tiên.');
  }
  if (applyType === 'field') {
    if (!fieldId || !getFieldIds(voucher).has(String(fieldId))) {
      throw makeError('Mã giảm giá không áp dụng cho sân này.');
    }
  }
  if (applyType === 'sport_type') {
    const allowedSports = new Set((voucher.sportTypes || []).map((type) => String(type).toLowerCase()));
    if (!sportType || !allowedSports.has(String(sportType).toLowerCase())) {
      throw makeError('Ma khong ap dung cho mon the thao nay.');
    }
  }
  if (applyType === 'weekend') {
    if (!isWeekendBooking(bookingDate)) {
      throw makeError('Ma chi ap dung cho ngay thu 7 va chu nhat.');
    }
  }
  if (applyType === 'time_slot') {
    const day = getBookingDay(bookingDate);
    const validDays = voucher.validDays || [];
    const from = timeToMinutes(voucher.validTimeFrom);
    const to = timeToMinutes(voucher.validTimeTo);
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (day === null || !validDays.includes(day) || start < from || end > to) {
      throw makeError('Ma khong ap dung trong khung gio nay.');
    }
  }

  const discountType = voucher.discountType || 'percent';
  let discountAmount = discountType === 'fixed'
    ? getDiscountValue(voucher)
    : (amount * getDiscountValue(voucher)) / 100;
  if (discountType === 'percent' && Number(voucher.maxDiscount || 0) > 0) {
    discountAmount = Math.min(discountAmount, Number(voucher.maxDiscount || 0));
  }
  discountAmount = Math.min(Math.round(discountAmount), amount);
  const finalAmount = Math.max(0, amount - discountAmount);

  return {
    voucher,
    userVoucher,
    response: {
      success: true,
      message: 'Ap dung ma giam gia thanh cong',
      voucherId: voucher._id,
      voucherCode: voucher.code,
      originalAmount: amount,
      discountAmount,
      finalAmount
    }
  };
};

const markVoucherUsed = async (booking, io) => {
  if (!booking?.voucherId || booking.voucherAppliedAt) return null;
  const voucher = await Voucher.findById(booking.voucherId);
  if (!voucher) return null;

  voucher.usedCount = getUsedCount(voucher) + 1;
  voucher.usageCount = voucher.usedCount;
  await voucher.save();

  const previousUserVoucher = await UserVoucher.findOne({ userId: booking.user, voucherId: voucher._id });
  const nextUserUsedCount = Number(previousUserVoucher?.usedCount || 0) + 1;
  const nextUserVoucherStatus = nextUserUsedCount >= Number(voucher.perUserLimit || 1) ? 'used' : 'available';
  const userVoucher = await UserVoucher.findOneAndUpdate(
    { userId: booking.user, voucherId: voucher._id },
    {
      $set: {
        code: voucher.code,
        status: nextUserVoucherStatus,
        usedCount: nextUserUsedCount,
        usedAt: new Date()
      },
      $setOnInsert: {
        userId: booking.user,
        voucherId: voucher._id,
        assignedAt: new Date()
      }
    },
    { upsert: true, new: true }
  );

  booking.voucherAppliedAt = new Date();
  await booking.save();
  return { voucher, userVoucher };
};

const createWelcomeVoucherNotification = async (userId, voucher, io) => {
  const existingNotification = await Notification.findOne({
    user: userId,
    type: 'voucher',
    'metadata.voucherCode': WELCOME_VOUCHER_CODE
  });
  if (existingNotification) return existingNotification;

  return createNotification({
    user: userId,
    title: WELCOME_VOUCHER_TITLE,
    message: WELCOME_VOUCHER_MESSAGE,
    type: 'voucher',
    relatedId: voucher._id,
    relatedModel: 'Voucher',
    link: WELCOME_VOUCHER_LINK,
    metadata: {
      voucherCode: WELCOME_VOUCHER_CODE,
      voucherId: voucher._id
    },
    io
  });
};

const assignWelcomeVoucherToUser = async (userId, voucher, io) => {
  const userVoucher = await UserVoucher.findOneAndUpdate(
    { userId, voucherId: voucher._id },
    {
      $setOnInsert: {
        userId,
        voucherId: voucher._id,
        code: voucher.code,
        status: 'available',
        usedCount: 0,
        assignedAt: new Date()
      }
    },
    { upsert: true, new: true }
  );

  await createWelcomeVoucherNotification(userId, voucher, io);
  return userVoucher;
};

const assignNewUserVouchers = async (user, io) => {
  await ensureWelcomeVoucher();
  const now = new Date();
  const vouchers = await Voucher.find({
    autoAssignNewUser: true,
    applyType: 'new_user',
    status: { $in: ['active', 'Active'] },
    startDate: { $lte: now },
    endDate: { $gte: now }
  });

  const assigned = [];
  for (const voucher of vouchers) {
    if (voucher.code === WELCOME_VOUCHER_CODE) {
      const userVoucher = await assignWelcomeVoucherToUser(user._id, voucher, io);
      assigned.push(userVoucher);
      continue;
    }

    const userVoucher = await UserVoucher.findOneAndUpdate(
      { userId: user._id, voucherId: voucher._id },
      {
        $setOnInsert: {
          userId: user._id,
          voucherId: voucher._id,
          code: voucher.code,
          status: 'available',
          usedCount: 0,
          assignedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );
    assigned.push(userVoucher);
    await createNotification({
      user: user._id,
      title: 'Ban vua nhan voucher moi',
      message: `Ban vua nhan voucher ${voucher.code} giam ${getDiscountValue(voucher)}${voucher.discountType === 'fixed' ? 'd' : '%'} cho lan dat san dau tien.`,
      type: 'promotion',
      relatedId: voucher._id,
      relatedModel: 'Voucher',
      io
    });
  }

  return assigned;
};

const ensureWelcomeVoucherForEligibleUser = async (userId, io) => {
  await ensureWelcomeVoucher();
  const welcomeVoucher = await getActiveWelcomeVoucher();
  if (!welcomeVoucher) return null;

  const existingUserVoucher = await UserVoucher.findOne({ userId, voucherId: welcomeVoucher._id });
  if (existingUserVoucher) {
    await createWelcomeVoucherNotification(userId, welcomeVoucher, io);
    return existingUserVoucher;
  }

  const successfulBooking = await Booking.exists(successfulBookingQuery(userId));
  if (successfulBooking) return null;

  return assignWelcomeVoucherToUser(userId, welcomeVoucher, io);
};

module.exports = {
  assignNewUserVouchers,
  assignWelcomeVoucherToUser,
  createWelcomeVoucherNotification,
  ensureWelcomeVoucher,
  ensureWelcomeVoucherForEligibleUser,
  getPublicStatus,
  markVoucherUsed,
  normalizeVoucherPayload,
  serializeVoucher,
  validateVoucherPayload,
  validateVoucherForBooking
};
