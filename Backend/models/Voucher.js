const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: [true, 'Mã code là bắt buộc'], 
    unique: true, 
    uppercase: true,
    trim: true 
  },
  name: { type: String, required: [true, 'Tên chương trình là bắt buộc'] },
  discountPercent: { type: Number, required: [true, 'Phần trăm giảm là bắt buộc'], min: 0, max: 100 },
  maxDiscount: { type: Number, required: [true, 'Giá trị giảm tối đa là bắt buộc'] },
  minOrderValue: { type: Number, default: 0 },
  
  // Ràng buộc áp dụng
  applicableFields: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Field' 
  }], 
  
  applicableUsers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],

  usageLimit: { type: Number, default: 100 },
  usageCount: { type: Number, default: 0 },
  startDate: { type: Date, required: [true, 'Ngày bắt đầu là bắt buộc'] },
  endDate: { type: Date, required: [true, 'Ngày kết thúc là bắt buộc'] },
  status: { 
    type: String, 
    enum: ['Active', 'Expired', 'Pending'],
    default: 'Active' 
  }
}, { timestamps: true });

// Middleware kiểm tra trạng thái linh hoạt
// Lưu ý: Phải dùng function() {} truyền thống để 'this' trỏ đúng vào document
voucherSchema.pre('save', function(next) {
  const now = new Date();
  
  if (this.endDate < now) {
    this.status = 'Expired';
  } else if (this.startDate > now) {
    this.status = 'Pending';
  } else {
    this.status = 'Active';
  }

  // Gọi next() để Mongoose tiếp tục tiến trình lưu
  if (typeof next === 'function') {
    next();
  }
});

module.exports = mongoose.model('Voucher', voucherSchema);