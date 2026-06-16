const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const {
  normalizeVoucherPayload,
  serializeVoucher,
  validateVoucherPayload,
  validateVoucherForBooking
} = require('../services/voucherService');

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
    const rows = await UserVoucher.find({ userId: req.user.id })
      .populate('voucherId')
      .sort({ assignedAt: -1 });

    const now = new Date();
    const response = [];
    for (const row of rows) {
      const voucher = row.voucherId;
      if (!voucher) continue;

      let status = row.status;
      if (voucher.endDate && new Date(voucher.endDate) < now) {
        status = 'expired';
        if (row.status !== 'expired') {
          row.status = 'expired';
          await row.save();
        }
      }

      const normalized = serializeVoucher(voucher);
      response.push({
        _id: row._id,
        voucherId: voucher._id,
        code: row.code || voucher.code,
        name: voucher.name,
        discountType: normalized.discountType,
        discountValue: normalized.discountValue,
        maxDiscount: normalized.maxDiscount,
        minOrderAmount: normalized.minOrderAmount,
        endDate: voucher.endDate,
        status,
        applyType: normalized.applyType,
        sportTypes: normalized.sportTypes || [],
        validDays: normalized.validDays || [],
        validTimeFrom: normalized.validTimeFrom || '',
        validTimeTo: normalized.validTimeTo || '',
        perUserLimit: normalized.perUserLimit,
        usedCount: row.usedCount
      });
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
