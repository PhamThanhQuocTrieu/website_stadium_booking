const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const Booking = require('../models/Booking');
const {
  ensureWelcomeVoucherForEligibleUser,
  normalizeVoucherPayload,
  serializeVoucher,
  validateVoucherPayload,
  validateVoucherForBooking
} = require('../services/voucherService');

const publicVoucherApplyTypes = ['all', 'field', 'sport_type', 'time_slot', 'weekend'];
const successfulBookingStatuses = ['paid', 'confirmed', 'completed'];
const successfulPaymentStatuses = ['paid', 'success'];
const unfinishedPaymentStatuses = ['pending', 'unpaid', 'failed', 'cancelled', 'refunded'];

const isTruthyQuery = (value) => ['1', 'true', 'yes'].includes(String(value || '').toLowerCase());
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

const getUserVoucherStatus = async ({ userId, voucher, row, now }) => {
  if (voucher.endDate && new Date(voucher.endDate) < now) return { status: 'expired', usedByUser: Number(row?.usedCount || 0) };

  const usedByVoucher = await Booking.countDocuments(successfulBookingQuery(userId, { voucherId: voucher._id }));
  const usedCount = Math.max(Number(row?.usedCount || 0), usedByVoucher);
  if (usedCount >= Number(voucher.perUserLimit || 1)) return { status: 'used', usedByUser: usedCount };

  if (voucher.applyType === 'new_user') {
    const hasSuccessfulBooking = await Booking.exists(successfulBookingQuery(userId));
    if (hasSuccessfulBooking) return { status: 'used', usedByUser: Math.max(usedCount, 1) };
  }

  return { status: row?.status || 'available', usedByUser: usedCount };
};

const buildVoucherResponse = ({ voucher, status = 'available', row = null, isPublic = false }) => {
  const normalized = serializeVoucher(voucher);
  return {
    _id: row?._id || voucher._id,
    voucherId: voucher._id,
    code: row?.code || voucher.code,
    name: voucher.name,
    discountType: normalized.discountType,
    discountValue: normalized.discountValue,
    maxDiscount: normalized.maxDiscount,
    minOrderAmount: normalized.minOrderAmount,
    endDate: voucher.endDate,
    status,
    applyType: normalized.applyType,
    description: normalized.applyType === 'new_user' ? 'Áp dụng cho lần đặt sân đầu tiên' : '',
    sportTypes: normalized.sportTypes || [],
    validDays: normalized.validDays || [],
    validTimeFrom: normalized.validTimeFrom || '',
    validTimeTo: normalized.validTimeTo || '',
    perUserLimit: normalized.perUserLimit,
    usedCount: row?.usedCount || 0,
    isPublic
  };
};

exports.getAllVouchers = async (req, res) => {
  try {
    const vouchers = await Voucher.find().sort({ createdAt: -1 });
    res.json(vouchers.map(serializeVoucher));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createVoucher = async (req, res) => {
  try {
    const payload = normalizeVoucherPayload(req.body);
    if (!payload.code || !payload.name || !payload.discountValue) {
      return res.status(400).json({ message: 'Vui long dien day du thong tin ma, ten va gia tri giam.' });
    }
    validateVoucherPayload(payload);

    const existingVoucher = await Voucher.findOne({ code: payload.code });
    if (existingVoucher) {
      return res.status(400).json({ message: 'Ma giam gia nay da ton tai.' });
    }

    const newVoucher = await Voucher.create(payload);
    res.status(201).json(serializeVoucher(newVoucher));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateVoucher = async (req, res) => {
  try {
    const payload = normalizeVoucherPayload(req.body);
    validateVoucherPayload(payload);
    const existingVoucher = await Voucher.findOne({
      code: payload.code,
      _id: { $ne: req.params.id }
    });

    if (existingVoucher) {
      return res.status(400).json({ message: 'Ma giam gia nay da ton tai.' });
    }

    const updatedVoucher = await Voucher.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );

    if (!updatedVoucher) {
      return res.status(404).json({ message: 'Khong tim thay ma giam gia.' });
    }

    res.json(serializeVoucher(updatedVoucher));
  } catch (err) {
    res.status(500).json({ message: 'Loi cap nhat: ' + err.message });
  }
};

exports.deleteVoucher = async (req, res) => {
  try {
    const deletedVoucher = await Voucher.findByIdAndDelete(req.params.id);
    if (!deletedVoucher) {
      return res.status(404).json({ message: 'Khong tim thay ma giam gia.' });
    }
    await UserVoucher.deleteMany({ voucherId: deletedVoucher._id });
    res.json({ message: 'Da xoa ma thanh cong' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.validateVoucher = async (req, res) => {
  try {
    const result = await validateVoucherForBooking({
      userId: req.user.id,
      ...req.body
    });
    res.json(result.response);
  } catch (err) {
    res.status(err.statusCode || 400).json({
      success: false,
      message: err.message || 'Co loi xay ra khi kiem tra ma.'
    });
  }
};

exports.checkVoucher = async (req, res) => {
  try {
    const result = await validateVoucherForBooking({
      userId: req.user?.id,
      code: req.query.code,
      fieldId: req.query.fieldId,
      originalAmount: req.query.totalPrice,
      bookingDate: req.query.bookingDate,
      startTime: req.query.startTime,
      endTime: req.query.endTime,
      sportType: req.query.sportType
    });
    res.json({
      voucherId: result.response.voucherId,
      discount: result.response.discountAmount,
      finalPrice: result.response.finalAmount
    });
  } catch (err) {
    res.status(err.statusCode || 400).json({ message: err.message || 'Co loi xay ra khi kiem tra ma.' });
  }
};

exports.getMyVouchers = async (req, res) => {
  try {
    await ensureWelcomeVoucherForEligibleUser(req.user.id, req.app.get('io'));

    const rows = await UserVoucher.find({ userId: req.user.id })
      .populate('voucherId')
      .sort({ assignedAt: -1 });

    const now = new Date();
    const response = [];
    const assignedVoucherIds = new Set();
    const responseVoucherIds = new Set();
    for (const row of rows) {
      const voucher = row.voucherId;
      if (!voucher) continue;
      assignedVoucherIds.add(String(voucher._id));
      responseVoucherIds.add(String(voucher._id));

      const { status, usedByUser } = await getUserVoucherStatus({ userId: req.user.id, voucher, row, now });
      if (status === 'expired') {
        if (row.status !== 'expired') {
          row.status = 'expired';
          await row.save();
        }
      } else if (status === 'used') {
        if (row.status !== 'used') {
          row.status = 'used';
          row.usedCount = Math.max(Number(row.usedCount || 0), usedByUser);
          row.usedAt = row.usedAt || new Date();
          await row.save();
        }
      }

      response.push(buildVoucherResponse({ voucher, status, row }));
    }

    if (isTruthyQuery(req.query.includePublic)) {
      const publicVouchers = await Voucher.find({
        applyType: { $in: publicVoucherApplyTypes },
        status: { $in: ['active', 'Active'] },
        startDate: { $lte: now },
        endDate: { $gte: now }
      }).sort({ createdAt: -1 });

      for (const voucher of publicVouchers) {
        if (assignedVoucherIds.has(String(voucher._id)) || responseVoucherIds.has(String(voucher._id))) continue;
        const normalized = serializeVoucher(voucher);
        if (normalized.status !== 'active') continue;

        const { status } = await getUserVoucherStatus({ userId: req.user.id, voucher, now });
        if (status === 'used' || status === 'expired') {
          continue;
        }

        try {
          await validateVoucherForBooking({
            userId: req.user.id,
            code: voucher.code,
            fieldId: req.query.fieldId,
            sportType: req.query.sportType,
            bookingDate: req.query.bookingDate,
            startTime: req.query.startTime,
            endTime: req.query.endTime,
            originalAmount: req.query.originalAmount || req.query.totalPrice
          });
          response.push(buildVoucherResponse({ voucher, isPublic: true }));
          responseVoucherIds.add(String(voucher._id));
        } catch (err) {
          if (!req.query.fieldId) {
            response.push(buildVoucherResponse({ voucher, status: 'available', isPublic: true }));
            responseVoucherIds.add(String(voucher._id));
          }
        }
      }
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
