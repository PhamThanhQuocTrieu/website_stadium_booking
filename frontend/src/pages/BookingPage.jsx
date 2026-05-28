import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Modal, Spinner } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'react-bootstrap-icons';
import axios from 'axios';
import { io } from 'socket.io-client';
import '../styles/BookingPage.css';

const socket = io('http://localhost:5000');

const BookingPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState([]); // Lưu mảng giờ sạch, ví dụ: ["14:00", "14:30"]
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [alertMessage, setAlertMessage] = useState(''); 
  
  // Khởi tạo ngày theo mốc thời gian thực tế lúc người dùng truy cập trang
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [fieldData, setFieldData] = useState(null);
  const [bookedSlots, setBookedSlots] = useState([]); 

  // Khởi tạo dải ma trận từ 5:00 đến 24:00 (Cách nhau mỗi block 30 phút)
  const timeSlots = [];
  for (let hour = 5; hour <= 23; hour++) {
    timeSlots.push(`${hour}:00`, `${hour}:30`);
  }

  // Hàm helper format ngày an toàn theo local time YYYY-MM-DD
  const formatDateStr = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchBookingStatus = async () => {
    if (!id || id === 'undefined') return;
    try {
      const dateStr = formatDateStr(selectedDate);
      const res = await axios.get(`http://localhost:5000/api/bookings/fields/${id}/booking-status?date=${dateStr}`);
      setFieldData(res.data.field);
      setBookedSlots(res.data.bookedSlots || []);
      setIsLoading(false);
    } catch (err) {
      console.error("Lỗi đồng bộ lịch biểu:", err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookingStatus();

    // HỆ THỐNG REAL-TIME: Nghe tín hiệu khóa ô từ máy khách khác gửi lên
    socket.on('slot_booked_success', (data) => {
      const dateStr = formatDateStr(selectedDate);
      if (data.fieldId === id && data.date === dateStr) {
        fetchBookingStatus();
        // Nếu ô người dùng đang chọn vô tình bị người khác khóa trước, tự động loại bỏ khỏi mảng chọn
        setSelectedSlots(prev => prev.filter(slot => !data.slots.includes(slot)));
      }
    });

    return () => socket.off('slot_booked_success');
  }, [id, selectedDate]);

  const triggerAlert = (msg) => {
    setAlertMessage(msg);
    setTimeout(() => setAlertMessage(''), 2000);
  };

  const getSlotStatus = (time) => {
    if (bookedSlots.includes(time)) return 'booked';
    
    const [hour, minute] = time.split(':').map(Number);
    const now = new Date();
    const slotTime = new Date(selectedDate);
    slotTime.setHours(hour, minute, 0, 0);
    
    if (slotTime <= now) return 'locked';
    return 'available';
  };

  const handleSlotClick = (time) => {
    const status = getSlotStatus(time);
    
    if (status === 'locked') {
      triggerAlert(`⚠️ Khung giờ ${time} đã trôi qua thực tế!`);
      return;
    }
    if (status === 'booked') {
      triggerAlert(`🚫 Khung giờ ${time} đã có khách đặt trước đó!`);
      return;
    }

    setSelectedSlots(prev => 
      prev.includes(time) ? prev.filter(s => s !== time) : [...prev, time]
    );
  };

  // KÍCH HOẠT DATABASE LOCKING KHI CHUYỂN HƯỚNG SANG TRANG XÁC NHẬN THANH TOÁN
  const handleProcessBooking = async () => {
    if (selectedSlots.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('userToken');
      const dateStr = formatDateStr(selectedDate);

      // Gửi mảng slot giờ lên Backend để chiếm quyền giữ chỗ Transaction độc quyền
      const res = await axios.post('http://localhost:5000/api/bookings/reserve', {
        fieldId: id,
        date: dateStr,
        slots: selectedSlots
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        // Chuyển tiếp sang trang Xác nhận thông tin bọc giao diện Glassmorphism độc quyền
        navigate('/payment', { state: { bookingId: res.data.bookingId, totalAmount: selectedSlots.length * 50000 } });
      }
    } catch (err) {
      triggerAlert(err.response?.data?.message || "Lỗi giữ chỗ, vui lòng thử lại!");
      fetchBookingStatus();
      setSelectedSlots([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const renderCalendarDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < startOffset; i++) days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    for (let d = 1; d <= totalDays; d++) {
      const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
      const dayToCheck = new Date(year, month, d);
      const isPastDay = dayToCheck < todayMidnight;

      days.push(
        <div 
          key={d} 
          className={`calendar-day ${isSelected ? 'active' : ''} ${isPastDay ? 'text-muted opacity-25' : ''}`}
          onClick={() => { 
            if (isPastDay) return;
            setSelectedDate(new Date(year, month, d)); 
            setIsLoading(true); 
            setShowDatePicker(false); 
          }}
          style={{ cursor: isPastDay ? 'not-allowed' : 'pointer' }}
        >
          {d}
        </div>
      );
    }
    return days;
  };

  if (isLoading || !fieldData) return (
    <div className="vh-100 bg-white d-flex flex-column justify-content-center align-items-center">
      <Spinner animation="border" variant="success" className="mb-3" />
      <h6 className="text-muted fw-bold">Đang dựng ma trận lịch biểu sân tập...</h6>
    </div>
  );

  return (
    <div className="booking-page-premium">
      
      {/* THÔNG BÁO NỔI TOAST ALERT KHI CLICK Ô ĐỎ/XÁM */}
      <AnimatePresence>
        {alertMessage && (
          <motion.div initial={{ opacity: 0, y: -20, x: "-50%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="custom-toast">
            {alertMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER PHÂN HỆ */}
      <header className="booking-nav-premium text-white">
        <Container className="d-flex align-items-center justify-content-between">
          <Button variant="link" className="text-white p-0" onClick={() => navigate(-1)}><ArrowLeft size={24} /></Button>
          <h5 className="fw-bold mb-0">Đặt lịch ngày trực quan — {fieldData.fieldName}</h5>
          <div className="date-pill-v3" onClick={() => setShowDatePicker(true)}>
            {selectedDate.toLocaleDateString('vi-VN')} 📅
          </div>
        </Container>
      </header>

      {/* THANH LƯU Ý HỆ THỐNG */}
      <div className="notice-bar text-center fw-bold">
        Lưu ý: Nếu bạn cần đặt lịch cố định vui lòng liên hệ Ban quản lý ArenaHub để được hỗ trợ kịp thời.
      </div>

      {/* CHÚ THÍCH BẢNG MÀU TRẠNG THÁI KHUNG GIỜ */}
      <div className="legend-container-v3">
        <Container className="d-flex gap-4 justify-content-start">
          <div className="legend-item-v3"><span className="box-demo empty"></span> Trống</div>
          <div className="legend-item-v3"><span className="box-demo booked"></span> Đã đặt</div>
          <div className="legend-item-v3"><span className="box-demo locked"></span> Khoá</div>
          <div className="legend-item-v3"><span className="box-demo selecting"></span> Đang chọn</div>
        </Container>
      </div>

      {/* MA TRẬN GRID FLAT MỘT DÒNG DUY NHẤT */}
      <Container className="my-4">
        <div className="matrix-wrapper shadow-sm">
          <div className="grid-matrix-container">
            
            {/* TIÊU ĐỀ HÀNG NGANG KHUNG GIỜ */}
            <div className="grid-time-header fw-bold text-dark" style={{fontSize: 12}}>KHUNG GIỜ</div>
            {timeSlots.map(time => (
              <div key={time} className="grid-time-header">{time}</div>
            ))}

            {/* HIỂN THỊ DUY NHẤT 1 DÒNG SÂN CHÍNH ĐANG TRUY CẬP */}
            <div className="grid-field-name-label border-bottom">SÂN CHÍNH</div>
            {timeSlots.map(time => {
              const status = getSlotStatus(time);
              const isSelected = selectedSlots.includes(time);
              return (
                <div 
                  key={time} 
                  className={`grid-slot-box ${status} ${isSelected ? 'active' : 'available'}`}
                  onClick={() => handleSlotClick(time)}
                />
              );
            })}

          </div>
        </div>
      </Container>

      {/* MODAL BỘ CHỌN LỊCH TRỰC QUAN CALENDAR */}
      <Modal show={showDatePicker} onHide={() => setShowDatePicker(false)} centered>
        <Modal.Body className="p-0 overflow-hidden rounded-3">
          <div className="p-4 text-white d-flex justify-content-between align-items-center" style={{background: '#0a4d31'}}>
            <ChevronLeft className="cursor-pointer" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} />
            <h5 className="fw-bold mb-0 text-uppercase">Tháng {viewDate.getMonth() + 1} / {viewDate.getFullYear()}</h5>
            <ChevronRight className="cursor-pointer" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} />
          </div>
          <div className="p-4 bg-white">
            <div className="calendar-grid-v2">
              <div className="week-days"><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span className="text-danger">CN</span></div>
              <div className="days-container">{renderCalendarDays()}</div>
            </div>
          </div>
        </Modal.Body>
      </Modal>

      {/* THANH FOOTER HIỂN THỊ TIẾN TRÌNH TỔNG TIỀN */}
      <AnimatePresence>
        {selectedSlots.length > 0 && (
          <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} className="payment-bar-v3">
            <Container className="d-flex align-items-center justify-content-between">
              <div className="text-white">
                <span className="small opacity-75 fw-bold">Tổng thời gian thuê: {(selectedSlots.length * 0.5)}h</span>
                <h4 className="fw-bold mb-0 text-warning">Tổng tiền: {(selectedSlots.length * 50000).toLocaleString()} đ</h4>
              </div>
              <Button className="btn-next-v3" disabled={isSubmitting} onClick={handleProcessBooking}>
                {isSubmitting ? 'ĐANG KHÓA...' : 'TIẾP THEO'}
              </Button>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BookingPage;