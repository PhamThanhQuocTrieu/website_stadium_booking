const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Ma code la bat buoc'],
    unique: true,
    uppercase: true,
    trim: true
  },
  name: { type: String, required: [true, 'Ten chuong trinh la bat buoc'], trim: true },

  discountType: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
  discountValue: { type: Number, min: 0 },
  discountPercent: { type: Number, min: 0, max: 100 },
  maxDiscount: { type: Number, default: 0 },

  minOrderAmount: { type: Number, default: 0 },
  minOrderValue: { type: Number, default: 0 },

  usageLimit: { type: Number, default: 100 },
  usedCount: { type: Number, default: 0 },
  usageCount: { type: Number, default: 0 },
  perUserLimit: { type: Number, default: 1 },

  applyType: {
    type: String,
    enum: ['all', 'new_user', 'field', 'sport_type', 'time_slot', 'weekend'],
    default: 'all'
  },
  fieldIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Field' }],
  applicableFields: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Field' }],
  applicableUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  sportTypes: [{ type: String, trim: true }],
  validDays: [{ type: Number, min: 0, max: 6 }],
  validTimeFrom: { type: String, default: '' },
  validTimeTo: { type: String, default: '' },
  autoAssignNewUser: { type: Boolean, default: false },

  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'expired', 'pending', 'Active', 'Expired', 'Pending'],
    default: 'active'
  },
  startDate: { type: Date, required: [true, 'Ngay bat dau la bat buoc'] },
  endDate: { type: Date, required: [true, 'Ngay ket thuc la bat buoc'] }
}, { timestamps: true });

voucherSchema.pre('save', function() {
  const now = new Date();

  if (this.discountValue === undefined || this.discountValue === null) {
    this.discountValue = Number(this.discountPercent || 0);
  }
  if (this.discountPercent === undefined || this.discountPercent === null) {
    this.discountPercent = this.discountType === 'percent' ? Number(this.discountValue || 0) : 0;
  }
  if (this.minOrderAmount === undefined || this.minOrderAmount === null) {
    this.minOrderAmount = Number(this.minOrderValue || 0);
  }
  if (this.minOrderValue === undefined || this.minOrderValue === null) {
    this.minOrderValue = Number(this.minOrderAmount || 0);
  }
  if (this.usedCount === undefined || this.usedCount === null) {
    this.usedCount = Number(this.usageCount || 0);
  }
  if (this.usageCount === undefined || this.usageCount === null) {
    this.usageCount = Number(this.usedCount || 0);
  }
  if ((!this.fieldIds || this.fieldIds.length === 0) && this.applicableFields?.length) {
    this.fieldIds = this.applicableFields;
  }
  if ((!this.applicableFields || this.applicableFields.length === 0) && this.fieldIds?.length) {
    this.applicableFields = this.fieldIds;
  }

  const status = String(this.status || '').toLowerCase();
  if (!['draft', 'inactive'].includes(status)) {
    if (this.endDate < now) this.status = 'expired';
    else if (this.startDate > now) this.status = 'pending';
    else this.status = 'active';
  } else {
    this.status = status;
  }

});

module.exports = mongoose.model('Voucher', voucherSchema);
