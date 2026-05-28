import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Spinner } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, ShieldCheck, CalendarCheck, Wallet2, 
  Person, Telephone, PencilSquare, InfoCircle 
} from 'react-bootstrap-icons';
import axios from 'axios';
import '../styles/PaymentPage.css';

const PaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Nhận dữ liệu Id hóa đơn tạm và danh sách slot từ BookingPage chuyển sang
  const { bookingId, totalAmount } = location.state || {};

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingDetail, setBookingDetail] = useState(null);

  // State quản lý form người đặt
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    note: ''
  });

  useEffect(() => {
    // Nếu cố tình vào trang này mà không đi đúng luồng chọn sân, đá về trang chủ
    if (!bookingId) {
      navigate('/');
      return;
    }

    // Lấy thông tin tài khoản đã đăng nhập để tự điền (Auto-fill) vào form cho Triệu
    const userInfo = JSON.parse(localStorage.getItem('userInfo')) || {};
    setFormData({
      fullName: userInfo.fullName || userInfo.username || '',
      phone: userInfo.phone || '',
      note: ''
    });

    // Gọi API lấy thông tin chi tiết của đơn đặt chỗ tạm thời (Để hiện tên sân, địa chỉ, ngày giờ cụ thể)
    const fetchTempBooking = async () => {
      try {
        const token = localStorage.getItem('userToken');
        const res = await axios.get(`http://localhost:5000/api/bookings/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBookingDetail(res.data);
        setIsLoading(false);
      } catch (err) {
        console.error("Lỗi tải thông tin hóa đơn:", err);
        setIsLoading(false);
      }
    };

    fetchTempBooking();
  }, [bookingId, navigate]);

  // Xử lý gửi yêu cầu thanh toán tích hợp VNPay Sandbox
  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone || isProcessing) return;

    setIsProcessing(true);
    try {
      const token = localStorage.getItem('userToken');
      
      // 1. Cập nhật thông tin khách hàng thực tế và ghi chú vào đơn hàng
      await axios.put(`http://localhost:5000/api/bookings/${bookingId}/update-info`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // 2. Gọi API khởi tạo đường dẫn thanh toán VNPay gateway
      const res = await axios.post(`http://localhost:5000/api/payments/create-vnpay-url`, {
        bookingId,
        amount: totalAmount
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.paymentUrl) {
        // Chuyển hướng người dùng sang cổng ngân hàng Sandbox của VNPay
        window.location.href = res.data.paymentUrl;
      }
    } catch (err) {
      alert(err.response?.data?.message || "Hệ thống VNPay đang bảo trì, vui lòng thử lại sau!");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) return (
    <div className="vh-100 bg-white d-flex flex-column justify-content-center align-items-center">
      <Spinner animation="border" variant="success" className="mb-2" />
      <h6 className="text-muted fw-bold">Đang mã hóa hóa đơn giao dịch an toàn...</h6>
    </div>
  );

  return (
    <div className="payment-page-premium">
      <Container>
        
        {/* NÚT QUAY LẠI TINH GỌN */}
        <div className="mb-4 d-flex align-items-center gap-3">
          <Button variant="light" className="rounded-circle p-2 border shadow-sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </Button>
          <h4 className="fw-bold mb-0 text-dark">Xác nhận thông tin đặt sân</h4>
        </div>

        <Row className="g-4">
          
          {/* CỘT TRÁI: TỔNG QUAN HÓA ĐƠN ĐẶT SÂN */}
          <Col lg={5}>
            <div className="summary-card-v3 shadow-sm mb-4">
              <div className="card-header-mint d-flex align-items-center gap-2">
                <ShieldCheck size={20} />
                <span>THÔNG TIN TÀI NGUYÊN SÂN</span>
              </div>
              <div className="p-4">
                <div className="info-item-row">
                  <span className="text-muted small fw-bold">TÊN SÂN TẬP</span>
                  <span className="fw-bold text-dark">{bookingDetail?.fieldId?.fieldName || "Sân bóng A1 ĐHCT"}</span>
                </div>
                <div className="info-item-row">
                  <span className="text-muted small fw-bold">ĐỊA CHỈ KHU VỰC</span>
                  <span className="fw-bold text-end text-secondary small" style={{maxWidth: '65%'}}>
                    {bookingDetail?.fieldId?.address || "Đường 3/2, Ninh Kiều, Cần Thơ"}
                  </span>
                </div>
              </div>
            </div>

            <div className="summary-card-v3 shadow-sm">
              <div className="card-header-mint d-flex align-items-center gap-2" style={{background: '#115e59'}}>
                <CalendarCheck size={20} />
                <span>CHI TIẾT LỊCH ĐẶT CHỖ</span>
              </div>
              <div className="p-4">
                <div className="info-item-row">
                  <span className="text-muted small fw-bold">NGÀY THI ĐẤU</span>
                  <span className="fw-bold text-primary">{bookingDetail?.date ? new Date(bookingDetail.date).toLocaleDateString('vi-VN') : "19/05/2026"}</span>
                </div>
                <div className="info-item-row align-items-start">
                  <span className="text-muted small fw-bold mt-1">KHUNG GIỜ CHỌN</span>
                  <div className="d-flex flex-wrap gap-2 justify-content-end" style={{maxWidth: '65%'}}>
                    {bookingDetail?.slots?.map((slot, idx) => (
                      <span key={idx} className="slot-badge-item">{slot}</span>
                    )) || <span className="slot-badge-item">14:00</span>}
                  </div>
                </div>
                <div className="info-item-row">
                  <span className="text-muted small fw-bold">TỔNG THỜI GIAN THUÊ</span>
                  <span className="fw-bold text-dark">{bookingDetail?.slots ? `${bookingDetail.slots.length * 30} phút` : "60 phút"}</span>
                </div>
                <div className="info-item-row pt-3 border-0">
                  <span className="fw-bold text-dark">THÀNH TIỀN HÓA ĐƠN</span>
                  <h4 className="fw-bold text-success mb-0">{(totalAmount || 100000).toLocaleString()} đ</h4>
                </div>
              </div>
            </div>
          </Col>

          {/* CỘT PHẢI: FORM THÔNG TIN NGƯỜI ĐẶT & ĐIỀU KHOẢN CHỐNG TRÙNG LỊCH */}
          <Col lg={7}>
            <div className="summary-card-v3 shadow-sm p-4 bg-white">
              <h5 className="fw-bold mb-4 text-dark border-start border-4 border-success ps-2">THÔNG TIN KHÁCH HÀNG TẠI QUẦY</h5>
              
              <Form onSubmit={handleConfirmPayment}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-secondary"><Person className="me-1"/> Tên người nhận sân *</Form.Label>
                  <Form.Control 
                    type="text" 
                    required
                    className="custom-input-box"
                    placeholder="Nhập đầy đủ họ và tên..."
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-secondary"><Telephone className="me-1"/> Số điện thoại liên hệ *</Form.Label>
                  <Form.Control 
                    type="text" 
                    required
                    className="custom-input-box"
                    placeholder="Nhập số điện thoại nhận mã sân..."
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label className="small fw-bold text-secondary"><PencilSquare className="me-1"/> Ghi chú cho chủ sân (Nếu có)</Form.Label>
                  <Form.Control 
                    as="textarea" 
                    rows={3} 
                    className="custom-input-box"
                    placeholder="Ví dụ: Cần thuê thêm bóng, mượn áo bít tập thi đấu..."
                    value={formData.note}
                    onChange={(e) => setFormData({...formData, note: e.target.value})}
                  />
                </Form.Group>

                {/* KHỐI ĐIỀU KHOẢN PHÒNG VỆ LUẬN VĂN */}
                <div className="policy-box-v3 mb-4">
                  <div className="d-flex align-items-center gap-2 text-danger fw-bold small mb-2">
                    <InfoCircle /> HƯỚNG DẪN AN TOÀN GIAO DỊCH
                  </div>
                  <ul className="text-muted small ps-3 mb-0" style={{lineHeight: '1.6'}}>
                    <li>Khung giờ của bạn đang được hệ thống <strong>Database Locking</strong> tạm giữ độc quyền trong thời gian thực hiện giao dịch.</li>
                    <li>ArenaHub đóng vai trò điều phối, kết nối tự động giúp chống trùng lịch (Double Booking) tuyệt đối.</li>
                    <li>Bằng việc bấm xác nhận, bạn đồng ý với Điều khoản sử dụng và Chính sách hoàn trả ví điện tử của chúng tôi.</li>
                  </ul>
                </div>

                <Button 
                  type="submit" 
                  className="w-100 btn-submit-payment d-flex align-items-center justify-content-center gap-2"
                  disabled={isProcessing}
                >
                  {isProcessing ? <Spinner animation="border" size="sm" /> : <Wallet2 />}
                  <span>XÁC NHẬN & THANH TOÁN QUA VNPAY</span>
                </Button>
              </Form>
            </div>
          </Col>

        </Row>
      </Container>
    </div>
  );
};

export default PaymentPage;