const mongoose = require('mongoose');
const Voucher = require('../models/Voucher');

// Lấy tất cả voucher
exports.getAllVouchers = async (req, res) => {
  try {
    await Voucher.updateMany(
      { endDate: { $lt: new Date() }, status: 'Active' },
      { status: 'Expired' }
    );
    const vouchers = await Voucher.find().sort({ createdAt: -1 });
    res.json(vouchers);
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
};

// Tạo voucher mới
exports.createVoucher = async (req, res) => {
  try {
    const { code, name, discountPercent, maxDiscount, applicableFields } = req.body;
    
    if (!code || !name || !discountPercent || !maxDiscount) {
      return res.status(400).json({ message: "Vui lòng điền đủ các trường bắt buộc!" });
    }

    const existingVoucher = await Voucher.findOne({ code: code.toUpperCase() });
    if (existingVoucher) {
      return res.status(400).json({ message: "Mã giảm giá này đã tồn tại!" });
    }

    // Xử lý an toàn: Chỉ ép kiểu nếu ID hợp lệ
    const validFields = (applicableFields || [])
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    const newVoucher = new Voucher({
      ...req.body,
      applicableFields: validFields
    });

    await newVoucher.save();
    res.status(201).json(newVoucher);
  } catch (err) { 
    console.error("Lỗi tạo voucher:", err);
    res.status(400).json({ message: err.message }); 
  }
};

// Cập nhật voucher
exports.updateVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, applicableFields } = req.body;
    
    const existingVoucher = await Voucher.findOne({ 
      code: code.toUpperCase(), 
      _id: { $ne: id } 
    });

    if (existingVoucher) {
      return res.status(400).json({ message: "Mã giảm giá này đã tồn tại!" });
    }

    const validFields = (applicableFields || [])
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    const updatedVoucher = await Voucher.findByIdAndUpdate(
      id, 
      { ...req.body, applicableFields: validFields }, 
      { new: true, runValidators: true }
    );
    
    if (!updatedVoucher) {
      return res.status(404).json({ message: "Không tìm thấy mã giảm giá!" });
    }
    
    res.json(updatedVoucher);
  } catch (err) { 
    res.status(500).json({ message: "Lỗi cập nhật: " + err.message }); 
  }
};

// Xóa voucher
exports.deleteVoucher = async (req, res) => {
  try {
    const deletedVoucher = await Voucher.findByIdAndDelete(req.params.id);
    if (!deletedVoucher) {
      return res.status(404).json({ message: "Không tìm thấy mã giảm giá!" });
    }
    res.json({ message: "Đã xóa mã thành công" });
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
};

// Kiểm tra mã khi user đặt sân
exports.checkVoucher = async (req, res) => {
  try {
    const { code, totalPrice, fieldId } = req.query;
    const voucher = await Voucher.findOne({ code: code.toUpperCase(), status: 'Active' });

    if (!voucher) {
      return res.status(404).json({ message: "Mã không tồn tại hoặc không khả dụng!" });
    }
    
    // Kiểm tra ràng buộc sân
    if (voucher.applicableFields && voucher.applicableFields.length > 0) {
      if (!fieldId || !mongoose.Types.ObjectId.isValid(fieldId) || 
          !voucher.applicableFields.includes(new mongoose.Types.ObjectId(fieldId))) {
        return res.status(400).json({ message: "Mã này không áp dụng cho sân bạn chọn!" });
      }
    }
    
    // Logic kiểm tra ngày và lượt dùng giữ nguyên...
    if (new Date() > new Date(voucher.endDate)) {
      return res.status(400).json({ message: "Mã giảm giá đã hết hạn!" });
    }
    
    if (voucher.usageCount >= voucher.usageLimit) {
      return res.status(400).json({ message: "Mã đã hết lượt sử dụng!" });
    }

    let discount = (totalPrice * voucher.discountPercent) / 100;
    if (discount > voucher.maxDiscount) discount = voucher.maxDiscount;

    res.json({ voucherId: voucher._id, discount, finalPrice: totalPrice - discount });
  } catch (err) {
    res.status(500).json({ message: "Có lỗi xảy ra khi kiểm tra mã!" });
  }
};