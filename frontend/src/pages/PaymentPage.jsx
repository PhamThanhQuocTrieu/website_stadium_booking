import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Spinner, Modal } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, ShieldCheck, CalendarCheck, Wallet2, 
  Person, Telephone, PencilSquare, InfoCircle, PlusCircle, Trash, QrCode 
} from 'react-bootstrap-icons';
import axios from 'axios';
import Swal from 'sweetalert2';
import api from '../api/api';
import vnpayLogo from '../assets/vnpay-logo.jpg';
import '../styles/PaymentPage.css';

const PaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Nhận dữ liệu Id hóa đơn tạm từ BookingPage hoặc từ thông báo hàng chờ.
  const queryParams = new URLSearchParams(location.search);
  const { bookingId: stateBookingId, totalAmount } = location.state || {};
  const bookingId = stateBookingId || queryParams.get('bookingId');

  // --- BỔ SUNG STATE DỊCH VỤ ---
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('VNPAY');
  // -----------------------------

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);
  const [bookingDetail, setBookingDetail] = useState(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [myVouchers, setMyVouchers] = useState([]);

  // State quản lý form người đặt
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    note: ''
  });

  const formatMoney = (value) => Number(value || 0).toLocaleString('vi-VN');

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
        const bookingData = bookingRes.data;
        const field = bookingData?.fieldId || bookingData?.field || {};
        const fieldId = field?._id || field;
        const servicesRes = fieldId
          ? await axios.get(`http://localhost:5000/api/services?fieldId=${fieldId}`)
          : { data: [] };
        setBookingDetail(bookingData);
        if (Array.isArray(bookingData?.services)) {
          setSelectedServices(bookingData.services);
        }
        setServices(servicesRes.data);
        try {
          const slots = bookingData?.slots || [];
          const voucherRes = await api.get('/user/vouchers', {
            params: {
              includePublic: true,
              fieldId,
              sportType: field?.type,
              bookingDate: bookingData?.date,
              startTime: bookingData?.startTime || slots[0],
              endTime: bookingData?.endTime || (slots.length > 0 ? addMinutesToTime(slots[slots.length - 1], 30) : undefined),
              originalAmount: totalAmount || bookingData?.originalAmount || bookingData?.totalPrice || 0
            }
          });
          setMyVouchers(Array.isArray(voucherRes.data) ? voucherRes.data : []);
        } catch {
          setMyVouchers([]);
        }
        setIsLoading(false);
      } catch (err) {
        console.error("Lỗi tải thông tin:", err);
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [bookingId, navigate, totalAmount]);

  // --- LOGIC XỬ LÝ DỊCH VỤ ---
  const getSelectedServiceQuantity = (serviceId) => (
    selectedServices.find(item => item.serviceId === serviceId)?.quantity || 0
  );

  const handleAddService = (service) => {
    setAppliedVoucher(null);
    const selectedQuantity = getSelectedServiceQuantity(service._id);
    if (selectedQuantity >= Number(service.stock || 0)) {
      Swal.fire('Da het so luong', `${service.name} hien khong con du so luong.`, 'warning');
      return;
    }
    setSelectedServices(prev => {
      const exists = prev.find(item => item.serviceId === service._id);
      if (exists) {
        return prev.map(item => item.serviceId === service._id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { serviceId: service._id, name: service.name, price: service.price, quantity: 1, image: service.image, inventoryType: service.inventoryType || 'rental' }];
    });
  };

  const removeService = (serviceId) => {
    setAppliedVoucher(null);
    setSelectedServices(prev => prev.filter(item => item.serviceId !== serviceId));
  };

  const updateServiceQuantity = (serviceId, delta) => {
    setAppliedVoucher(null);
    if (delta > 0) {
      const service = services.find(item => item._id === serviceId);
      const selectedQuantity = getSelectedServiceQuantity(serviceId);
      if (service && selectedQuantity >= Number(service.stock || 0)) {
        Swal.fire('Da het so luong', `${service.name} hien khong con du so luong.`, 'warning');
        return;
      }
    }
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

  const calculateFieldSubtotal = () => {
    const savedSubtotal = Number(bookingDetail?.subtotal || 0);
    if (savedSubtotal > 0) return savedSubtotal;
    if (totalAmount) return Number(totalAmount);

    const savedTotal = Number(bookingDetail?.originalAmount || bookingDetail?.totalPrice || 0);
    const savedServiceTotal = Number(bookingDetail?.serviceTotal || 0);
    return Math.max(0, savedTotal - savedServiceTotal);
  };
  const calculateServiceTotal = () => selectedServices.reduce((sum, item) => {
    return sum + (Number(item.price || 0) * Number(item.quantity || 0));
  }, 0);
  const calculateOriginalTotal = () => calculateFieldSubtotal() + calculateServiceTotal();
  const calculateFinalTotal = () => appliedVoucher?.finalAmount ?? calculateOriginalTotal();
  const calculateDiscount = () => appliedVoucher?.discountAmount ?? 0;
  // ---------------------------

  const handleApplyVoucher = async (codeToApply = voucherCode) => {
    const normalizedCode = String(codeToApply || '').trim().toUpperCase();
    if (!normalizedCode || isApplyingVoucher) return;

    setIsApplyingVoucher(true);
    try {
      const field = bookingDetail?.fieldId || bookingDetail?.field || {};
      const res = await api.post('/vouchers/validate', {
        code: normalizedCode,
        fieldId: field?._id || field,
        sportType: field?.type,
        bookingDate: bookingDetail?.date,
        startTime: bookingDetail?.startTime,
        endTime: bookingDetail?.endTime,
        originalAmount: calculateOriginalTotal()
      });
      setVoucherCode(normalizedCode);
      setAppliedVoucher(res.data);
      Swal.fire('Thanh cong', res.data.message || 'Da ap dung ma giam gia', 'success');
    } catch (err) {
      setAppliedVoucher(null);
      Swal.fire('Khong ap dung duoc', err.response?.data?.message || 'Ma giam gia khong hop le', 'error');
    } finally {
      setIsApplyingVoucher(false);
    }
  };

  const clearVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode('');
  };

  // Xử lý gửi yêu cầu thanh toán tích hợp VNPay Sandbox
  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone || isProcessing) return;

    setIsProcessing(true);
    try {
      const token = localStorage.getItem('userToken');

      // 1. Cập nhật thông tin khách hàng, ghi chú VÀ dịch vụ vào đơn hàng
      const updateRes = await axios.put(`http://localhost:5000/api/bookings/${bookingId}/update-info`, {
        ...formData,
        services: selectedServices,
        voucherCode: appliedVoucher?.voucherCode || ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updatedBooking = updateRes.data || {};
      setBookingDetail(updatedBooking);
      const paymentAmount = Number(
        updatedBooking.finalAmount ?? updatedBooking.totalPrice ?? calculateFinalTotal()
      );

      // 2. Gọi API khởi tạo đường dẫn thanh toán VNPay gateway
      const res = await axios.post(`http://localhost:5000/api/payments/vnpay/create`, {
        bookingId,
        amount: paymentAmount
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      }
    } catch (err) {
      Swal.fire('Loi thanh toan', err.response?.data?.message || "He thong VNPay dang bao tri, vui long thu lai sau!", 'error');
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
                        <div className="text-secondary small">{s.quantity} x {formatMoney(s.price)}đ</div>
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
                        <div className="fw-bold text-success">{formatMoney(Number(s.price || 0) * Number(s.quantity || 0))}đ</div>
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
                  <h4 className="fw-bold text-success mb-0">{formatMoney(calculateFieldSubtotal())} đ</h4>
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

                <div className="voucher-box mb-4">
                  <div className="small fw-bold text-secondary mb-3">MA GIAM GIA</div>
                  <div className="d-flex gap-2 flex-wrap">
                    <Form.Control
                      className="custom-input-box flex-grow-1"
                      placeholder="Nhap ma voucher"
                      value={voucherCode}
                      onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setAppliedVoucher(null); }}
                    />
                    <Button type="button" variant="success" disabled={isApplyingVoucher || !voucherCode.trim()} onClick={() => handleApplyVoucher()}>
                      {isApplyingVoucher ? <Spinner animation="border" size="sm" /> : 'Ap dung'}
                    </Button>
                    {appliedVoucher && <Button type="button" variant="outline-secondary" onClick={clearVoucher}>Bo ma</Button>}
                  </div>

                  {myVouchers.length > 0 && (
                    <div className="my-voucher-strip mt-3">
                      {myVouchers.filter((voucher) => voucher.status === 'available').slice(0, 4).map((voucher) => (
                        <button
                          type="button"
                          key={voucher._id}
                          className="mini-voucher"
                          onClick={() => handleApplyVoucher(voucher.code)}
                        >
                          <span className="fw-bold">{voucher.code}</span>
                          <small>{voucher.discountType === 'fixed' ? `${formatMoney(voucher.discountValue)}đ` : `${voucher.discountValue}%`}</small>
                        </button>
                      ))}
                    </div>
                  )}

                  {appliedVoucher && (
                    <div className="voucher-success mt-3">
                      Đã áp dụng {appliedVoucher.voucherCode}, giảm {formatMoney(appliedVoucher.discountAmount)}đ
                    </div>
                  )}
                </div>

                <div className="policy-box-v3 mb-4">
                  <div className="d-flex align-items-center gap-2 text-danger fw-bold small mb-2"><InfoCircle /> HƯỚNG DẪN AN TOÀN GIAO DỊCH</div>
                  <ul className="text-muted small ps-3 mb-0" style={{ lineHeight: '1.6' }}>
                    <li>Khung giờ của bạn đang được hệ thống <strong>Database Locking</strong> tạm giữ độc quyền.</li>
                    <li>ArenaHub đóng vai trò điều phối, kết nối tự động giúp chống trùng lịch (Double Booking).</li>
                    <li>Bằng việc bấm xác nhận, bạn đồng ý với Điều khoản sử dụng và Chính sách hoàn trả.</li>
                  </ul>
                </div>

                <div className="payment-total-box mt-4 mb-4">
                  <div>
                    <span>Tiền sân</span>
                    <strong>{formatMoney(calculateFieldSubtotal())} đ</strong>
                  </div>
                  <div>
                    <span>Dịch vụ bổ sung</span>
                    <strong>{formatMoney(calculateServiceTotal())} đ</strong>
                  </div>
                  {selectedServices.length > 0 && (
                    <div className="service-breakdown">
                      {selectedServices.map((service) => {
                        const quantity = Number(service.quantity || 0);
                        const price = Number(service.price || 0);
                        return (
                          <div key={service.serviceId || service._id || service.name}>
                            <span>
                              {service.name} <small>x{quantity} ({formatMoney(price)}đ)</small>
                            </span>
                            <strong>{formatMoney(price * quantity)} đ</strong>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="subtotal">
                    <span>Tạm tính</span>
                    <strong>{formatMoney(calculateOriginalTotal())} đ</strong>
                  </div>
                  <div>
                    <span>{appliedVoucher ? `Voucher ${appliedVoucher.voucherCode}` : 'Giảm giá'}</span>
                    <strong className="text-danger">- {formatMoney(calculateDiscount())} đ</strong>
                  </div>
                  <div className="final">
                    <span>Tổng thanh toán</span>
                    <strong>{formatMoney(calculateFinalTotal())} đ</strong>
                  </div>
                </div>
                <div className="payment-method-box mb-4">
                  <div className="small fw-bold text-secondary mb-3">PHƯƠNG THỨC THANH TOÁN</div>
                  <div className="payment-method-grid">
                    <button
                      type="button"
                      className={`payment-method-card ${paymentMethod === 'VNPAY' ? 'selected' : ''}`}
                      onClick={() => setPaymentMethod('VNPAY')}
                    >
                      <span className="payment-method-logo">
                        <img src={vnpayLogo} alt="VNPAY" />
                      </span>
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
            ) : services.map(s => {
              const selectedQuantity = getSelectedServiceQuantity(s._id);
              const remainingStock = Math.max(0, Number(s.stock || 0) - selectedQuantity);
              const isOutOfStock = remainingStock <= 0;
              return (
              <Col md={6} key={s._id} className="mb-3">
                <div className="d-flex p-2 border rounded align-items-center" style={{ opacity: isOutOfStock ? 0.45 : 1 }}>
                  <img src={s.image} style={{ width: 50, height: 50 }} alt={s.name} />
                  <div className="ms-3 flex-grow-1">
                    <div className="fw-bold">{s.name}</div>
                    <small className="text-muted d-block">{formatMoney(s.price)} đ</small>
                    <small className={isOutOfStock ? 'text-danger fw-bold' : 'text-success'}>
                      {isOutOfStock ? 'Het so luong' : `Con ${remainingStock}`}
                    </small>
                  </div>
                  <Button size="sm" variant="success" disabled={isOutOfStock} onClick={() => handleAddService(s)}>+</Button>
                </div>
              </Col>
              );
            })}
          </Row>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default PaymentPage;
