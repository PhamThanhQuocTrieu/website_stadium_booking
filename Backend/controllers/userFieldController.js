// File: Backend/controllers/userFieldController.js
const Field = require('../models/Field');
const Review = require('../models/Review'); 

// =========================================================================
// 1. [GET] LẤY DANH SÁCH SÂN CHO NGƯỜI DÙNG (CÓ ĐỒNG BỘ BẢNG GIÁ)
// =========================================================================
exports.userGetFields = async (req, res) => {
  try {
    const { isFeatured, type } = req.query;
    let query = {};
    
    if (isFeatured) query.isFeatured = isFeatured === 'true';
    if (type) query.type = type;

    const fields = await Field.find(query)
      .where({ status: 'Active' })
      .populate('pricingRules');

    res.json(fields);
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
