// File: Backend/controllers/reviewController.js
const Review = require('../models/Review');

// =========================================================================
// [POST] TIẾP NHẬN PHẢN HỒI ĐÁNH GIÁ MỚI VÀ LƯU VÀO CSDL LOCAL
// =========================================================================
exports.userCreateReview = async (req, res) => {
  try {
    const { id } = req.params; // ID của sân bóng từ URL
    const { name, email, comment, ratingsDetail } = req.body;

    if (!name || !email || !comment) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ các trường bắt buộc (*)" });
    }

    // Công thức tính điểm trung bình tổng quan từ 4 tiêu chí đánh giá dạng Form-Range
    const avgRating = Math.round(
      (ratingsDetail.sanBai + ratingsDetail.trangThietBi + ratingsDetail.dichVu + ratingsDetail.viTriGia) / 4
    );

    // Tiến hành ghi dữ liệu mới xuống MongoDB Local
    const newReview = await Review.create({
      field: id,
      name,
      email,
      comment,
      rating: avgRating,
      ratingsDetail
    });

    return res.status(201).json({ success: true, data: newReview });
  } catch (error) {
    console.error("❌ Lỗi tại reviewController -> userCreateReview:", error.message);
    return res.status(500).json({ message: "Không thể xử lý và lưu phản hồi đánh giá lúc này." });
  }
};