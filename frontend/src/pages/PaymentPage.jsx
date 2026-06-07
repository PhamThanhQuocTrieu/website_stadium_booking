import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Spinner, Modal } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, ShieldCheck, CalendarCheck, Wallet2, 
  Person, Telephone, PencilSquare, InfoCircle, PlusCircle, Trash, CreditCard2Front, QrCode 
} from 'react-bootstrap-icons';
import axios from 'axios';
import '../styles/PaymentPage.css';

const PaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Nhận dữ liệu Id hóa đơn tạm và danh sách slot từ BookingPage chuyển sang
  const { bookingId, totalAmount } = location.state || {};

  // --- BỔ SUNG STATE DỊCH VỤ ---
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('VNPAY');
  // -----------------------------

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

    // Gọi API lấy thông tin chi tiết của đơn đặt chỗ và danh sách dịch vụ
    const fetchAllData = async () => {
      try {
        const token = localStorage.getItem('userToken');
        const bookingRes = await axios.get(`http://localhost:5000/api/bookings/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const fieldId = bookingRes.data?.fieldId?._id || bookingRes.data?.field?._id || bookingRes.data?.field;
        const servicesRes = fieldId
          ? await axios.get(`http://localhost:5000/api/services?fieldId=${fieldId}`)
          : { data: [] };
        setBookingDetail(bookingRes.data);
        setServices(servicesRes.data);
        setIsLoading(false);
      } catch (err) {
        console.error("Lỗi tải thông tin:", err);
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [bookingId, navigate]);

  // --- LOGIC XỬ LÝ DỊCH VỤ ---
  const handleAddService = (service) => {
    setSelectedServices(prev => {
      const exists = prev.find(item => item.serviceId === service._id);
      if (exists) {
        return prev.map(item => item.serviceId === service._id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { serviceId: service._id, name: service.name, price: service.price, quantity: 1, image: service.image }];
    });
  };

  const removeService = (serviceId) => {
    setSelectedServices(prev => prev.filter(item => item.serviceId !== serviceId));
  };

  const updateServiceQuantity = (serviceId, delta) => {
    setSelectedServices(prev => (
      prev
        .map(item => (
          item.serviceId === serviceId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        ))
        .filter(item => item.quantity > 0)
    ));
  };

  const addMinutesToTime = (time, minutesToAdd) => {
    const [hour = 0, minute = 0] = String(time || '00:00').split(':').map(Number);
    const totalMinutes = hour * 60 + minute + minutesToAdd;
    const nextHour = Math.floor(totalMinutes / 60);
    const nextMinute = totalMinutes % 60;
    return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
  };

  const getBookingTimeRange = () => {
    if (bookingDetail?.startTime && bookingDetail?.endTime) {
      return `${bookingDetail.startTime} - ${bookingDetail.endTime}`;
    }

    const slots = bookingDetail?.slots || [];
    if (slots.length > 0) {
      return `${slots[0]} - ${addMinutesToTime(slots[slots.length - 1], 30)}`;
    }

    return '14:00 - 15:00';
  };

  const calculateFinalTotal = () => {
    const serviceTotal = selectedServices.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return (totalAmount || 0) + serviceTotal;
  };
  // ---------------------------

  // Xử lý gửi yêu cầu thanh toán tích hợp VNPay Sandbox
  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone || isProcessing) return;

    setIsProcessing(true);
    try {
      const token = localStorage.getItem('userToken');

      // 1. Cập nhật thông tin khách hàng, ghi chú VÀ dịch vụ vào đơn hàng
      await axios.put(`http://localhost:5000/api/bookings/${bookingId}/update-info`, {
        ...formData,
        services: selectedServices,
        totalPrice: calculateFinalTotal()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // 2. Gọi API khởi tạo đường dẫn thanh toán VNPay gateway
      const res = await axios.post(`http://localhost:5000/api/payments/vnpay/create`, {
        bookingId,
        amount: calculateFinalTotal()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.paymentUrl) {
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
                  <span className="fw-bold text-end text-secondary small" style={{ maxWidth: '65%' }}>
                    {bookingDetail?.fieldId?.address || "Đường 3/2, Ninh Kiều, Cần Thơ"}
                  </span>
                </div>
              </div>
            </div>

            {/* PHẦN DỊCH VỤ BỔ SUNG */}
            <div className="summary-card-v3 shadow-sm mb-4">
              <div className="card-header-mint d-flex align-items-center justify-content-between p-3" style={{ background: '#0a4d31' }}>
                <span className="text-white fw-bold">DỊCH VỤ BỔ SUNG</span>
                <Button size="sm" variant="light" className="text-success" onClick={() => setShowServiceModal(true)}>
                  <PlusCircle size={18} />
                </Button>
              </div>

              <div className="p-3">
                {selectedServices.length === 0 ? (
                  <div className="text-center text-muted py-3 small">Chưa chọn dịch vụ nào</div>
                ) : (
                  selectedServices.map((s, i) => (
                    <div key={i} className="d-flex align-items-center mb-3 pb-2 border-bottom">
                      <img src={s.image} style={{ width: 40, height: 40, borderRadius: '4px', objectFit: 'cover' }} alt="" />
                      <div className="ms-3 flex-grow-1">
                        <div className="fw-bold text-dark small">{s.name}</div>
                        <div className="text-secondary small">{s.quantity} x {s.price.toLocaleString()}đ</div>
                        <div className="d-inline-flex align-items-center border rounded-pill overflow-hidden mt-2">
                          <Button
                            size="sm"
                            variant="light"
                            className="border-0 px-2 py-0 fw-bold"
                            onClick={() => updateServiceQuantity(s.serviceId, -1)}
                          >
                            -
                          </Button>
                          <span className="px-2 small fw-bold text-dark">{s.quantity}</span>
                          <Button
                            size="sm"
                            variant="light"
                            className="border-0 px-2 py-0 fw-bold text-success"
                            onClick={() => updateServiceQuantity(s.serviceId, 1)}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="fw-bold text-success">{(s.price * s.quantity).toLocaleString()}đ</div>
                        <Trash size={16} className="text-danger cursor-pointer mt-1" onClick={() => removeService(s.serviceId)} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="summary-card-v3 shadow-sm">
              <div className="card-header-mint d-flex align-items-center gap-2" style={{ background: '#115e59' }}>
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
                  <span className="slot-badge-item">{getBookingTimeRange()}</span>
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
                  <Form.Label className="small fw-bold text-secondary"><Person className="me-1" /> Tên người nhận sân *</Form.Label>
                  <Form.Control
                    type="text" required className="custom-input-box"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-secondary"><Telephone className="me-1" /> Số điện thoại liên hệ *</Form.Label>
                  <Form.Control
                    type="text" required className="custom-input-box"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label className="small fw-bold text-secondary"><PencilSquare className="me-1" /> Ghi chú cho chủ sân (Nếu có)</Form.Label>
                  <Form.Control
                    as="textarea" rows={3} className="custom-input-box"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  />
                </Form.Group>

                <div className="policy-box-v3 mb-4">
                  <div className="d-flex align-items-center gap-2 text-danger fw-bold small mb-2"><InfoCircle /> HƯỚNG DẪN AN TOÀN GIAO DỊCH</div>
                  <ul className="text-muted small ps-3 mb-0" style={{ lineHeight: '1.6' }}>
                    <li>Khung giờ của bạn đang được hệ thống <strong>Database Locking</strong> tạm giữ độc quyền.</li>
                    <li>ArenaHub đóng vai trò điều phối, kết nối tự động giúp chống trùng lịch (Double Booking).</li>
                    <li>Bằng việc bấm xác nhận, bạn đồng ý với Điều khoản sử dụng và Chính sách hoàn trả.</li>
                  </ul>
                </div>

                <div className="h4 text-success fw-bold mt-4">Tổng cộng: {calculateFinalTotal().toLocaleString()} đ</div>
                <div className="payment-method-box mb-4">
                  <div className="small fw-bold text-secondary mb-3">PHƯƠNG THỨC THANH TOÁN</div>
                  <div className="payment-method-grid">
                    <button
                      type="button"
                      className={`payment-method-card ${paymentMethod === 'VNPAY' ? 'selected' : ''}`}
                      onClick={() => setPaymentMethod('VNPAY')}
                    >
                      <span className="payment-method-icon"><CreditCard2Front size={24} /></span>
                      <span>
                        <span className="fw-bold text-dark d-block">VNPAY</span>
                        <span className="text-muted small d-block">Thanh toán qua ATM, Internet Banking, QR VNPAY</span>
                      </span>
                    </button>

                    <button type="button" className="payment-method-card disabled" disabled>
                      <span className="payment-method-icon muted"><QrCode size={24} /></span>
                      <span>
                        <span className="fw-bold text-dark d-block">VietQR</span>
                        <span className="text-muted small d-block">Sắp ra mắt</span>
                      </span>
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-100 btn-submit-payment d-flex align-items-center justify-content-center gap-2"
                  disabled={isProcessing}
                >
                  {isProcessing ? <Spinner animation="border" size="sm" /> : <Wallet2 />}
                  <span>XÁC NHẬN & THANH TOÁN</span>
                </Button>
              </Form>
            </div>
          </Col>
        </Row>
      </Container>

      {/* MODAL CHỌN DỊCH VỤ */}
      <Modal show={showServiceModal} onHide={() => setShowServiceModal(false)} size="lg" centered dialogClassName="payment-service-modal">
        <Modal.Header closeButton><Modal.Title>Danh sách dịch vụ</Modal.Title></Modal.Header>
        <Modal.Body>
          <Row>
            {services.length === 0 ? (
              <Col xs={12}>
                <div className="text-center text-muted py-4 small">Sân này chưa có dịch vụ đi kèm khả dụng.</div>
              </Col>
            ) : services.map(s => (
              <Col md={6} key={s._id} className="mb-3">
                <div className="d-flex p-2 border rounded align-items-center">
                  <img src={s.image} style={{ width: 50, height: 50 }} alt={s.name} />
                  <div className="ms-3 flex-grow-1">
                    <div className="fw-bold">{s.name}</div>
                    <small className="text-muted">{s.price.toLocaleString()} đ</small>
                  </div>
                  <Button size="sm" variant="success" onClick={() => handleAddService(s)}>+</Button>
                </div>
              </Col>
            ))}
          </Row>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default PaymentPage;
