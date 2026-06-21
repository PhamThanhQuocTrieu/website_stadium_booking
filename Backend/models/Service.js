const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên dịch vụ là bắt buộc'],
    trim: true,
    unique: true 
  },
  description: {
    type: String,
    default: '',
    maxLength: [500, 'Mô tả quá dài']
  },
  image: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: [true, 'Giá dịch vụ là bắt buộc'],
    min: [0, 'Giá không được nhỏ hơn 0']
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Số lượng tồn kho không được âm']
  },
  inventoryType: {
    type: String,
    enum: ['rental', 'consumable'],
    default: 'rental'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Bổ sung: Danh sách các sân áp dụng dịch vụ
  appliedFields: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Field' // Đảm bảo tên Model sân của bạn là 'Field'
  }]
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
