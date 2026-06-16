const mongoose = require('mongoose');

const userVoucherSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher', required: true },
  code: { type: String, trim: true, uppercase: true },
  usedCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['available', 'used', 'expired'],
    default: 'available'
  },
  assignedAt: { type: Date, default: Date.now },
  usedAt: Date
}, { timestamps: true });

userVoucherSchema.index({ userId: 1, voucherId: 1 }, { unique: true });

module.exports = mongoose.model('UserVoucher', userVoucherSchema);
