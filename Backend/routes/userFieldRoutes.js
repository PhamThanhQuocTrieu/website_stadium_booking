// File: Backend/routes/userFieldRoutes.js
const express = require('express');
const router = express.Router();

// 🌟 IMPORT TỪ CẢ 2 CONTROLLER ĐÃ BÓC TÁCH ĐỘC LẬP
const { userGetFields, userGetFieldById } = require('../controllers/userFieldController');
const { userCreateReview } = require('../controllers/reviewController'); 

// Import các Models để xử lý logic nội bộ tuyến đường ma trận lịch
const Booking = require('../models/Booking'); 
const Field = require('../models/Field'); 

// =========================================================================
// 1. Endpoint: GET /api/fields - Lấy danh sách toàn bộ sân bãi (Đã nạp bảng giá)
// =========================================================================
router.get('/', userGetFields);

// =========================================================================
// 2. Endpoint: GET /api/fields/:id - Lấy chi tiết thông tin 1 sân & mảng Reviews
// =========================================================================
router.get('/:id', userGetFieldById);

// =========================================================================
// 3. Endpoint: POST /api/fields/:id/reviews - 🌟 GỬI BÌNH LUẬN ĐÁNH GIÁ MỚI LƯU CSDL
// =========================================================================
router.post('/:id/reviews', userCreateReview);

// =========================================================================
// 4. Endpoint: GET /api/fields/:id/booking-status - Lấy ma trận ô giờ theo ngày
// =========================================================================
router.get('/:id/booking-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query; // Nhận tham số ngày lọc dạng YYYY-MM-DD từ Client gửi lên

    // Bước A: Kiểm tra xem tài nguyên sân bãi này có tồn tại trong hệ thống Database không
    const field = await Field.findById(id).populate('pricingRules'); // Nạp kèm bảng giá để Frontend hiển thị thông tin
    if (!field) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài nguyên sân bãi này!' });
    }

    // Bước B: Quét và lọc tất cả các đơn đặt sân dựa trên trạng thái bảo hộ giữ chỗ tạm thời
    // 🌟 FIX LỖI CHÍ MẠNG: Đổi fieldId thành field để khớp 100% với Schema của Model Booking
    const activeBookings = await Booking.find({
      field: id,
      date: date,
      status: 'Confirmed' // Đơn hàng mang status Confirmed (gồm cả Pending thanh toán và Paid) đều được bảo hộ khóa ô
    });

    // Bước C: Gom tất cả các mảng slot giờ đã bị khóa cứng lại thành một dải mảng phẳng duy nhất
    let bookedSlots = [];
    activeBookings.forEach(booking => {
      // KIỂM TRA BỔ SUNG: Nếu đơn hàng là Pending thanh toán nhưng đã quá 5 phút (tránh trường hợp Cron Job chưa quét tới)
      // thì thuật toán xử lý hiển thị ma trận sẽ chủ động bỏ qua, nhường ô trắng lại cho người khác đặt
      const isExpiredPending = booking.paymentStatus === 'Pending' && (new Date() - new Date(booking.createdAt) > 5 * 60 * 1000);
      
      if (!isExpiredPending && booking.slots) {
        bookedSlots = bookedSlots.concat(booking.slots);
      }
    });

    // Bước D: Phản hồi dữ liệu sạch về tầng Frontend để render ngay lập tức các ô màu đỏ/màu trắng
    return res.status(200).json({
      field,
      bookedSlots
    });

  } catch (error) {
    console.error('❌ Lỗi phân hệ kiểm tra trạng thái ma trận giờ:', error.message);
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;