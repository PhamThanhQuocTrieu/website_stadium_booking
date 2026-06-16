import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Container, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { CalendarCheck, CreditCard, Eye, Home, MapPin, MessageSquare, RefreshCw, RotateCcw, Search, XCircle } from 'lucide-react';
import { Star, StarFill } from 'react-bootstrap-icons';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import axiosClient from '../api/axiosClient';
import '../styles/MyBookingsPage.css';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;
const normalize = (value) => String(value || '').trim().toLowerCase();
const text = (value, fallback = '-') => value || fallback;

const paymentStatusMap = {
  pending: 'Chờ thanh toán',
  unpaid: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  success: 'Đã thanh toán',
  failed: 'Thanh toán thất bại',
  cancelled: 'Thanh toán thất bại',
  refunded: 'Đã hoàn tiền'
};

const bookingStatusMap = {
  pending: 'Chờ xử lý',
  pending_payment: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  playing: 'Đang diễn ra',
  completed: 'Hoàn thành',
  cancel_requested: 'Chờ xử lý',
  cancelled: 'Đã hủy',
  canceled: 'Đã hủy',
  refunded: 'Đã hoàn tiền',
  'da hoan thanh': 'Hoàn thành'
};

const mapStatusLabel = (type, status) => {
  const key = normalize(status);
  const source = type === 'paymentStatus' ? paymentStatusMap : bookingStatusMap;
  return source[key] || source[key.replace(/\s+/g, '_')] || 'Không xác định';
};

const statusMeta = {
  pending: { className: 'badge-pending' },
  confirmed: { className: 'badge-confirmed' },
  playing: { className: 'badge-playing' },
  completed: { className: 'badge-completed' },
  cancel_requested: { className: 'badge-pending' },
  cancelled: { className: 'badge-cancelled' },
  refunded: { className: 'badge-refunded' }
};

const filters = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ xử lý' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'playing', label: 'Đang diễn ra' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã hủy' }
];

const getField = (booking) => booking?.fieldId || booking?.field || {};
const getFieldId = (booking) => {
  const field = getField(booking);
  return field?._id || field || '';
};

const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('vi-VN');
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('vi-VN');
};

const getPaymentStatus = (booking) => {
  const raw = normalize(booking?.payment?.status || booking?.paymentStatus);
  if (raw === 'pENDING'.toLowerCase()) return 'pending';
  if (raw === 'unpaid') return 'pending';
  if (raw === 'paid' || raw === 'success') return 'success';
  if (raw === 'failed' || raw === 'cancelled') return 'failed';
  if (raw === 'refunded') return 'refunded';
  return raw || 'pending';
};

const getBookingStatus = (booking) => {
  const raw = normalize(booking?.bookingStatus || booking?.status);
  const startAt = new Date(`${booking?.date}T${booking?.startTime || '00:00'}:00`);
  const endAt = new Date(`${booking?.date}T${booking?.endTime || '00:00'}:00`);
  const now = Date.now();

  if (raw === 'pending_payment') return 'pending';
  if (raw === 'completed' || raw === 'da hoan thanh') return 'completed';
  if (raw === 'cancel_requested') return 'cancel_requested';
  if (raw === 'cancelled' || raw === 'canceled') return 'cancelled';
  if (raw === 'refunded') return 'refunded';
  if (raw === 'pending') return 'pending';
  if (raw === 'confirmed') {
    if (isPaid(booking) && !Number.isNaN(endAt.getTime()) && now > endAt.getTime()) return 'completed';
    if (!Number.isNaN(startAt.getTime()) && !Number.isNaN(endAt.getTime()) && now >= startAt.getTime() && now <= endAt.getTime()) return 'playing';
  }
  return raw || 'pending';
};

const isPaymentPending = (booking) => getPaymentStatus(booking) === 'pending';
const isPaid = (booking) => ['paid', 'success'].includes(getPaymentStatus(booking));

const getServiceTotal = (booking) => {
  const services = Array.isArray(booking?.services) ? booking.services : [];
  return Number(booking?.serviceTotal || services.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0));
};

const getBreakdown = (booking) => {
  const serviceTotal = getServiceTotal(booking);
  const total = Number(booking?.payment?.amount || booking?.totalPrice || 0);
  const discount = Number(booking?.discountAmount || 0);
  const fee = Number(booking?.transactionFee || 0);
  const subtotal = Math.max(0, Number(booking?.subtotal || total - serviceTotal + discount - fee));
  return [
    ['Tiền sân', subtotal],
    ['Tiền dịch vụ', serviceTotal],
    ['Giảm giá', discount ? -discount : 0],
    ['Phí giao dịch', fee],
    ['Tổng cộng', total]
  ];
};

const MyBookingsPage = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [detailBooking, setDetailBooking] = useState(null);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/bookings/my-bookings');
      setBookings(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải lịch sử đặt sân.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const stats = useMemo(() => {
    return bookings.reduce((acc, booking) => {
      const status = getBookingStatus(booking);
      acc.total += 1;
      if (status === 'confirmed') acc.confirmed += 1;
      if (status === 'completed') acc.completed += 1;
      if (status === 'cancelled') acc.cancelled += 1;
      return acc;
    }, { total: 0, confirmed: 0, completed: 0, cancelled: 0 });
  }, [bookings]);

  const visibleBookings = useMemo(() => {
    const keyword = normalize(searchTerm);
    return bookings.filter((booking) => {
      const bookingStatus = getBookingStatus(booking);
      const field = getField(booking);
      const haystack = [
        booking?._id,
        field?.fieldName,
        field?.type,
        field?.address,
        booking?.date,
        booking?.payment?.txnRef,
        booking?.txnRef
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesFilter = activeFilter === 'all' ||
        bookingStatus === activeFilter ||
        (activeFilter === 'pending' && bookingStatus === 'cancel_requested');
      return matchesFilter && (!keyword || haystack.includes(keyword));
    });
  }, [bookings, activeFilter, searchTerm]);

  const updateBookingInList = (bookingId, data) => {
    setBookings((prev) => prev.map((item) => (
      item._id === bookingId
        ? { ...item, ...data.booking, field: item.field, fieldId: item.fieldId, payment: data.payment || item.payment }
        : item
    )));
  };

  const handlePayNow = (booking) => {
    const total = Number(booking?.totalPrice || booking?.payment?.amount || 0);
    const serviceTotal = getServiceTotal(booking);
    navigate('/payment', {
      state: {
        bookingId: booking._id,
        totalAmount: Number(booking?.subtotal || Math.max(0, total - serviceTotal))
      }
    });
  };

  const handleRequestCancel = async (booking) => {
    const paid = isPaid(booking);
    const result = await Swal.fire({
      title: paid ? 'Yêu cầu hủy đặt sân?' : 'Hủy đặt sân?',
      text: paid
        ? 'Đơn đã thanh toán sẽ chuyển sang trạng thái chờ admin xác nhận hủy.'
        : 'Đơn chưa thanh toán sẽ được hủy trực tiếp.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: paid ? 'Gửi yêu cầu hủy' : 'Hủy đặt sân',
      cancelButtonText: 'Đóng',
      confirmButtonColor: '#dc2626'
    });

    if (!result.isConfirmed) return;

    try {
      const { data } = await axiosClient.patch(`/bookings/${booking._id}/request-cancel`);
      updateBookingInList(booking._id, data);
      Swal.fire({
        icon: 'success',
        title: paid ? 'Đã gửi yêu cầu hủy' : 'Đã hủy booking',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire('Không thể hủy', err.response?.data?.message || 'Vui lòng thử lại sau.', 'error');
    }
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!reviewBooking || submitting) return;
    if (!String(reviewForm.comment || '').trim()) {
      Swal.fire('Thiếu bình luận', 'Vui lòng nhập nội dung đánh giá.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await axiosClient.post('/reviews', {
        bookingId: reviewBooking._id,
        fieldId: getFieldId(reviewBooking),
        rating: reviewForm.rating,
        comment: reviewForm.comment
      });
      setReviewBooking(null);
      await fetchBookings();
      Swal.fire({ icon: 'success', title: 'Đã gửi đánh giá', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Không thể gửi đánh giá', err.response?.data?.message || 'Vui lòng thử lại sau.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (value, size = 22, interactive = false) => [1, 2, 3, 4, 5].map((starValue) => {
    const Icon = Number(value) >= starValue ? StarFill : Star;
    return (
      <button
        key={starValue}
        type="button"
        className={`rating-star-button ${Number(value) >= starValue ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
        disabled={!interactive}
        onClick={() => setReviewForm((prev) => ({ ...prev, rating: starValue }))}
      >
        <Icon size={size} />
      </button>
    );
  });

  const navigateToField = (booking, rebook = false) => {
    const fieldId = getFieldId(booking);
    if (!fieldId) return;
    navigate(rebook ? `/field-detail/${fieldId}?rebook=${booking._id}` : `/field-detail/${fieldId}`);
  };

  if (loading) {
    return (
      <div className="my-bookings-page">
        <div className="booking-loading"><Spinner animation="border" variant="success" /><span>Đang tải lịch sử đặt sân...</span></div>
      </div>
    );
  }

  return (
    <div className="my-bookings-page">
      <Container>
        <div className="booking-history-hero">
          <div>
            <Badge bg="success" className="hero-badge">ArenaHub</Badge>
            <h1>Lịch sử đặt sân</h1>
            <p>Quản lý booking, theo dõi thanh toán, yêu cầu hủy và đánh giá trải nghiệm sau khi hoàn thành.</p>
          </div>
          <Button variant="light" onClick={fetchBookings}><RefreshCw size={17} /> Làm mới</Button>
        </div>

        <Row className="g-3 stats-row">
          <Col sm={6} lg={3}><div className="stat-card"><span>Tổng số đơn</span><strong>{stats.total}</strong></div></Col>
          <Col sm={6} lg={3}><div className="stat-card accent-blue"><span>Đã xác nhận</span><strong>{stats.confirmed}</strong></div></Col>
          <Col sm={6} lg={3}><div className="stat-card accent-green"><span>Hoàn thành</span><strong>{stats.completed}</strong></div></Col>
          <Col sm={6} lg={3}><div className="stat-card accent-red"><span>Đã hủy</span><strong>{stats.cancelled}</strong></div></Col>
        </Row>

        <Card className="booking-toolbar">
          <Card.Body>
            <div className="filter-tabs">
              {filters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={activeFilter === filter.key ? 'active' : ''}
                  onClick={() => setActiveFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="booking-search">
              <Search size={18} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm theo mã đơn, tên sân, ngày đặt..."
              />
            </div>
          </Card.Body>
        </Card>

        {error && <div className="booking-error">{error}</div>}

        {visibleBookings.length === 0 ? (
          <Card className="empty-booking-state">
            <Card.Body>
              <CalendarCheck size={48} />
              <h3>Chưa có booking phù hợp</h3>
              <p>Thử đổi bộ lọc hoặc đặt sân mới để bắt đầu quản lý lịch chơi của bạn.</p>
              <Button variant="success" href="/fields">Tìm sân ngay</Button>
            </Card.Body>
          </Card>
        ) : (
          <Row className="g-4">
            {visibleBookings.map((booking) => {
              const field = getField(booking);
              const fieldId = getFieldId(booking);
              const bookingStatus = getBookingStatus(booking);
              const paymentStatus = getPaymentStatus(booking);
              const meta = statusMeta[bookingStatus] || statusMeta.pending;
              const canPay = paymentStatus === 'pending' && !['cancel_requested', 'cancelled', 'completed'].includes(bookingStatus);
              const canRequestCancel = ['pending', 'confirmed'].includes(bookingStatus);
              const canReview = bookingStatus === 'completed' && !booking.review && !booking.reviewed;
              const payment = booking.payment || {};

              return (
                <Col xl={6} key={booking._id}>
                  <Card className="booking-history-card">
                    <div className="booking-cover" style={{ backgroundImage: `url(${field?.image || '/image/football.jpg'})` }}>
                      <span className={`status-badge ${meta.className}`}>{mapStatusLabel('bookingStatus', bookingStatus)}</span>
                    </div>
                    <Card.Body>
                      <div className="booking-card-heading">
                        <div>
                          <h3>{text(field?.fieldName, 'Sân thể thao')}</h3>
                          <p><MapPin size={15} /> {text(field?.address, 'Địa chỉ đang cập nhật')}</p>
                        </div>
                        <Badge bg={paymentStatus === 'success' ? 'success' : paymentStatus === 'failed' ? 'danger' : 'warning'} text={paymentStatus === 'success' || paymentStatus === 'failed' ? undefined : 'dark'}>
                          {mapStatusLabel('paymentStatus', paymentStatus)}
                        </Badge>
                      </div>

                      <div className="booking-meta-grid">
                        <div><span>Loại sân</span><strong>{text(field?.type)}</strong></div>
                        <div><span>Ngày đặt</span><strong>{formatDate(booking.date)}</strong></div>
                        <div><span>Khung giờ</span><strong>{text(booking.startTime)} - {text(booking.endTime)}</strong></div>
                        <div><span>Tổng tiền</span><strong>{money(payment.amount || booking.totalPrice)}</strong></div>
                        <div><span>Phương thức</span><strong>{text(payment.method || booking.paymentMethod, 'VNPAY')}</strong></div>
                        <div><span>Ngày tạo</span><strong>{formatDateTime(booking.createdAt)}</strong></div>
                      </div>

                      <div className="booking-id-row">
                        <span>Mã đơn: {booking._id}</span>
                        <span>TxnRef: {text(payment.txnRef || booking.txnRef)}</span>
                      </div>

                      <div className="booking-card-actions">
                        <Button variant="outline-success" onClick={() => setDetailBooking(booking)}><Eye size={16} /> Xem chi tiết</Button>
                        {!['cancel_requested', 'cancelled'].includes(bookingStatus) && (
                          <Button variant="outline-primary" disabled={!fieldId} onClick={() => navigateToField(booking, true)}><RotateCcw size={16} /> Đặt lại</Button>
                        )}
                        {canPay && <Button variant="success" onClick={() => handlePayNow(booking)}><CreditCard size={16} /> Thanh toán ngay</Button>}
                        {canRequestCancel && <Button variant="outline-danger" onClick={() => handleRequestCancel(booking)}><XCircle size={16} /> Yêu cầu hủy</Button>}
                        {canReview && <Button variant="success" onClick={() => setReviewBooking(booking)}><MessageSquare size={16} /> Đánh giá</Button>}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Container>

      <Modal show={Boolean(detailBooking)} onHide={() => setDetailBooking(null)} centered size="lg" dialogClassName="booking-detail-modal">
        <Modal.Header closeButton>
          <Modal.Title>Chi tiết booking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailBooking && (
            <>
              <div className="detail-field-header">
                <div className="detail-field-image" style={{ backgroundImage: `url(${getField(detailBooking)?.image || '/image/football.jpg'})` }} />
                <div>
                  <h4>{text(getField(detailBooking)?.fieldName, 'Sân thể thao')}</h4>
                  <p><Home size={16} /> {text(getField(detailBooking)?.type)}</p>
                  <p><MapPin size={16} /> {text(getField(detailBooking)?.address, 'Địa chỉ đang cập nhật')}</p>
                </div>
              </div>

              <div className="detail-section-grid">
                <div><span>Người đặt</span><strong>{text(detailBooking.user?.fullName || detailBooking.userName, 'Tài khoản của bạn')}</strong></div>
                <div><span>Ngày giờ</span><strong>{formatDate(detailBooking.date)} | {detailBooking.startTime} - {detailBooking.endTime}</strong></div>
                <div><span>Slot</span><strong>{Array.isArray(detailBooking.slots) && detailBooking.slots.length ? detailBooking.slots.join(', ') : `${detailBooking.startTime} - ${detailBooking.endTime}`}</strong></div>
                <div><span>Giao dịch VNPAY</span><strong>{text(detailBooking.payment?.txnRef || detailBooking.txnRef || detailBooking.payment?.transactionNo)}</strong></div>
                <div><span>Trạng thái booking</span><strong>{mapStatusLabel('bookingStatus', getBookingStatus(detailBooking))}</strong></div>
                <div><span>Trạng thái thanh toán</span><strong>{mapStatusLabel('paymentStatus', getPaymentStatus(detailBooking))}</strong></div>
                <div className="detail-wide"><span>Ghi chú</span><strong>{text(detailBooking.note || detailBooking.cancelReason, 'Không có ghi chú')}</strong></div>
              </div>

              <h5 className="detail-title">Dịch vụ đi kèm</h5>
              {Array.isArray(detailBooking.services) && detailBooking.services.length ? (
                <div className="detail-services">
                  {detailBooking.services.map((service, index) => (
                    <div key={service.serviceId || index}>
                      <span>{text(service.name, 'Dịch vụ')}</span>
                      <strong>{Number(service.quantity || 1)} x {money(service.price)}</strong>
                    </div>
                  ))}
                </div>
              ) : <div className="empty-inline">Không có dịch vụ đi kèm.</div>}

              <h5 className="detail-title">Breakdown thanh toán</h5>
              <div className="detail-breakdown">
                {getBreakdown(detailBooking).map(([label, value], index, list) => (
                  <div className={index === list.length - 1 ? 'total' : ''} key={label}>
                    <span>{label}</span>
                    <strong>{money(value)}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>

      <Modal show={Boolean(reviewBooking)} onHide={() => setReviewBooking(null)} centered dialogClassName="review-modal-dialog">
        <Modal.Header closeButton>
          <Modal.Title>Đánh giá sân</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitReview}>
          <Modal.Body>
            <div className="mb-3">
              <div className="small fw-bold text-muted mb-2">Số sao</div>
              <div className="rating-stars">{renderStars(reviewForm.rating, 30, true)}</div>
            </div>
            <Form.Group>
              <Form.Label className="small fw-bold text-muted">Bình luận</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={reviewForm.comment}
                onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
                placeholder="Chia sẻ trải nghiệm thực tế của bạn..."
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setReviewBooking(null)}>Đóng</Button>
            <Button type="submit" variant="success" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Gửi đánh giá'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default MyBookingsPage;
