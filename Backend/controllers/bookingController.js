// File: Backend/controllers/bookingController.js
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const cron = require('node-cron');

// =========================================================================
// 🔄 BACKGROUND JOB: TỰ ĐỘNG GIẢI PHÓNG SÂN SAU 5 PHÚT KHÔNG THANH TOÁN
// =========================================================================
// Cứ mỗi 1 phút (chiến lược cron: * * * * *), hệ thống quét ngầm database 1 lần
cron.schedule('* * * * *', async () => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Tìm các đơn đặt sân quá 5 phút mà vẫn chưa chịu thanh toán thành công
    const expiredBookings = await Booking.find({
      paymentStatus: 'Pending',
      status: 'Confirmed',
      createdAt: { $lte: fiveMinutesAgo }
    });

    if (expiredBookings.length > 0) {
      for (let booking of expiredBookings) {
        booking.status = 'Cancelled'; // Chuyển sang hủy để giải phóng khung giờ
        await booking.save();
        console.log(`🕒 [Background Job] Đã hủy đơn giữ chỗ hết hạn: ${booking._id}`.yellow);
      }
    }
  } catch (error) {
    console.error("❌ Lỗi chạy Background Job quét đơn hết hạn:", error.message);
  }
});

// =========================================================================
// 1. HÀM DỰNG MA TRẬN LỊCH BIỂU (ĐỒNG BỘ Ô LƯỚI THỜI GIAN THỰC)
// =========================================================================
exports.getBookingStatus = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { date } = req.query;

    if (!fieldId) {
      return res.status(400).json({ message: "Thiếu thông tin ID sân bóng!" });
    }

    const queryDateStr = date || new Date().toISOString().split('T')[0];

    // Chỉ quét các đơn đang hợp lệ (Trạng thái Confirmed)
    const bookings = await Booking.find({
      field: new mongoose.Types.ObjectId(fieldId),
      date: String(queryDateStr).trim(),
      status: 'Confirmed'
    });

    let bookedSlots = [];
    bookings.forEach(b => {
      // KIỂM TRA BỔ SUNG: Nếu đơn hàng là Pending thanh toán nhưng đã quá 5 phút (mà cron job chưa kịp quét tới)
      // thì thuật toán xử lý hiển thị sẽ tự động mở khóa luôn cho Frontend đặt đè lên được
      const isExpiredPending = b.paymentStatus === 'Pending' && (new Date() - new Date(b.createdAt) > 5 * 60 * 1000);
      
      if (!isExpiredPending && b.startTime && b.endTime) {
        let current = b.startTime;
        while (current < b.endTime) {
          bookedSlots.push(current);
          const [h, m] = current.split(':').map(Number);
          let nm = m + 30;
          let nh = h;
          if (nm >= 60) { nm -= 60; nh += 1; }
          current = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
        }
      }
    });

    return res.status(200).json({
      field: { _id: fieldId, fieldName: "Sân bóng A1 ĐHCT" },
      bookedSlots: bookedSlots
    });

  } catch (error) {
    console.error("❌ Lỗi ma trận tại Controller:", error.message);
    return res.status(500).json({ message: error.message });
  }
};

// =========================================================================
// 2. HÀM XỬ LÝ GIỮ CHỖ TẠM THỜI (KHI ẤN NÚT TIẾP THEO)
// =========================================================================
exports.reserveSlots = async (req, res) => {
  try {
    const { fieldId, date, slots, totalPrice, startTime, endTime } = req.body;
    
    if (!slots || slots.length === 0) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn ít nhất một khung giờ!" });
    }
    
    const sortedSlots = [...slots].sort();
    const finalStartTime = startTime || sortedSlots[0];
    
    let finalEndTime = endTime;
    if (!finalEndTime && sortedSlots.length > 0) {
      const lastSlot = sortedSlots[sortedSlots.length - 1];
      const [hours, minutes] = lastSlot.split(':').map(Number);
      let newMinutes = minutes + 30;
      let newHours = hours;
      if (newMinutes >= 60) { newMinutes -= 60; newHours += 1; }
      finalEndTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
    }

    // Kiểm tra xem khung giờ này có đang bị chiếm giữ hợp lệ bởi đơn nào khác không
    const existingBooking = await Booking.findOne({
      field: new mongoose.Types.ObjectId(fieldId),
      date,
      startTime: finalStartTime,
      status: 'Confirmed'
    });
    
    if (existingBooking) {
      // Nếu có đơn trùng, nhưng đơn đó là Pending quá 5 phút thì cho phép đặt đè lên (Hủy đơn cũ đi)
      const isExpiredPending = existingBooking.paymentStatus === 'Pending' && (new Date() - new Date(existingBooking.createdAt) > 5 * 60 * 1000);
      
      if (isExpiredPending) {
        existingBooking.status = 'Cancelled';
        await existingBooking.save();
      } else {
        return res.status(400).json({ success: false, message: "Khung giờ này đang được người khác giữ chỗ!" });
      }
    }
    
    // Tiến hành tạo bản ghi giữ sân tạm thời với paymentStatus: 'Pending'
    const newBooking = await Booking.create({
      user: new mongoose.Types.ObjectId(req.user.id),   
      field: new mongoose.Types.ObjectId(fieldId),     
      date,
      startTime: finalStartTime, 
      endTime: finalEndTime,
      totalPrice: totalPrice || (slots.length * 50000),
      paymentStatus: 'Pending',  // Chờ thanh toán
      status: 'Confirmed'        // Đơn hàng đang được bảo hộ giữ ô
    });
    
    // Phát tín hiệu Socket.io báo cho tất cả mọi người biết để tạm thời đổi ô này thành màu đỏ (Đã đặt)
    if (req.io) {
      req.io.emit('slot_booked_success', { fieldId, date, slots });
    }
    
    return res.status(200).json({ success: true, bookingId: newBooking._id });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Hệ thống Index vật lý đã chặn đứng hành vi đặt trùng!" });
    }
    return res.status(500).json({ message: error.message });
  }
};

// =========================================================================
// 3. HÀM TRUY XUẤT CHI TIẾT ĐƠN ĐẶT SÂN THEO ID (DẬP TẮT LỖI 404 TRÊN TRANG PAYMENT)
// =========================================================================
exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    // Tìm đơn đặt và liên kết (populate) bảng Field để lấy địa chỉ, tên sân hiển thị lên hóa đơn
    const booking = await Booking.findById(id).populate('field');
    
    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy thông tin đơn đặt sân này!" });
    }

    return res.status(200).json(booking);
  } catch (error) {
    console.error("❌ Lỗi lấy chi tiết đơn hàng:", error.message);
    return res.status(500).json({ message: error.message });
  }
};