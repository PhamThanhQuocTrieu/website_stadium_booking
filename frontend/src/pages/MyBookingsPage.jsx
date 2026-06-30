import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Container, Form, Modal, Row, Spinner } from 'react-bootstrap';
import {
  CalendarCheck,
  Camera,
  CreditCard,
  Eye,
  Home,
  MapPin,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
  XCircle
} from 'lucide-react';
import { Star, StarFill } from 'react-bootstrap-icons';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import axiosClient from '../api/axiosClient';
import '../styles/MyBookingsPage.css';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} d`;
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
  pending_payment: 'Chờ thanh toán',
  confirmed: 'Đã xác nhận',
  playing: 'Đang diễn ra',
  completed: 'Hoàn thành',
  cancel_requested: 'Chờ xử lý',
  cancelled: 'Đã hủy',
  canceled: 'Đã hủy',
  refunded: 'Đã hoàn tiền',
  'da hoan thanh': 'Hoàn thành',
  'hoan thanh': 'Hoàn thành',
  'da hoan thanh': 'Hoàn thành'
};

const statusMeta = {
  pending: { className: 'badge-pending' },
  pending_payment: { className: 'badge-pending' },
  confirmed: { className: 'badge-confirmed' },
  playing: { className: 'badge-playing' },
  completed: { className: 'badge-completed' },
  cancel_requested: { className: 'badge-pending' },
  cancelled: { className: 'badge-cancelled' },
  refunded: { className: 'badge-refunded' }
};

const filters = [
  { key: 'all', label: 'Tất cả ' },
  { key: 'pending', label: 'Chờ thanh toán' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'playing', label: 'Đang diễn ra' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã hủy' }
];

const BOOKINGS_PER_PAGE = 4;

const defaultReviewForm = {
  fieldQuality: 0,
  serviceQuality: 0,
  cleanliness: 0,
  priceReasonable: 0,
  comment: '',
  wouldRecommend: true,
  images: [],
  imagePreviews: []
};

const reviewCriteria = [
  { key: 'fieldQuality', label: 'Chất lượng sân' },
  { key: 'serviceQuality', label: 'Dịch vụ / Thái độ phục vụ' },
  { key: 'cleanliness', label: 'Vệ sinh sân' },
  { key: 'priceReasonable', label: 'Giá cả có hợp lý không' }
];

const calculateReviewAverage = (form) => {
  const total = reviewCriteria.reduce((sum, item) => sum + Number(form[item.key] || 0), 0);
  return Math.round(total / reviewCriteria.length);
};

const uploadReviewImages = async (files = []) => {
  const uploads = files.map(async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'arenahub_preset');
    const res = await fetch('https://api.cloudinary.com/v1_1/dp8zttoxz/image/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Upload image failed');
    const data = await res.json();
    return data.secure_url;
  });
  return Promise.all(uploads);
};

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

const mapStatusLabel = (type, status) => {
  const key = normalize(status);
  const source = type === 'paymentStatus' ? paymentStatusMap : bookingStatusMap;
  return source[key] || source[key.replace(/\s+/g, '_')] || 'Không xác định';
};

const getPaymentStatus = (booking) => {
  const raw = normalize(booking?.payment?.status || booking?.paymentStatus);
  if (raw === 'unpaid') return 'pending';
  if (raw === 'paid' || raw === 'success') return 'success';
  if (raw === 'failed' || raw === 'cancelled') return 'failed';
  if (raw === 'refunded') return 'refunded';
  return raw || 'pending';
};

const isPaid = (booking) => ['paid', 'success'].includes(getPaymentStatus(booking));

const getBookingStatus = (booking) => {
  const raw = normalize(booking?.bookingStatus || booking?.status);
  const startAt = new Date(`${booking?.date}T${booking?.startTime || '00:00'}:00`);
  const endAt = new Date(`${booking?.date}T${booking?.endTime || '00:00'}:00`);
  const now = Date.now();

  if (raw === 'pending_payment') return 'pending_payment';
  if (raw === 'completed' || raw === 'Đã hoàn thành' || raw === 'hoàn thành') return 'completed';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [detailBooking, setDetailBooking] = useState(null);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [reviewForm, setReviewForm] = useState(defaultReviewForm);
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

  const stats = useMemo(() => bookings.reduce((acc, booking) => {
    const status = getBookingStatus(booking);
    acc.total += 1;
    if (status === 'confirmed') acc.confirmed += 1;
    if (status === 'completed') acc.completed += 1;
    if (status === 'cancelled') acc.cancelled += 1;
    return acc;
  }, { total: 0, confirmed: 0, completed: 0, cancelled: 0 }), [bookings]);

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
        (activeFilter === 'pending' && ['pending_payment', 'cancel_requested'].includes(bookingStatus));
      return matchesFilter && (!keyword || haystack.includes(keyword));
    });
  }, [bookings, activeFilter, searchTerm]);

  const totalPages = Math.max(Math.ceil(visibleBookings.length / BOOKINGS_PER_PAGE), 1);
  const paginatedBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * BOOKINGS_PER_PAGE;
    return visibleBookings.slice(startIndex, startIndex + BOOKINGS_PER_PAGE);
  }, [visibleBookings, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

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
      title: paid ? 'Yêu cầu hủy đặt sân?' : 'Yêu cầu hủy đặt sân?',
      text: paid
        ? 'Đơn đã thanh toán sẽ chuyển sang trạng thái chờ admin xác nhận hủy.'
        : 'Đơn chưa thanh toán sẽ được hủy trực tiếp.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: paid ? 'Gửi yêu cầu hủy' : 'Yêu cầu hủy đặt sân',
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

  const openReviewModal = (booking) => {
    setReviewForm(defaultReviewForm);
    setReviewBooking(booking);
  };

  const closeReviewModal = () => {
    setReviewBooking(null);
    setReviewForm(defaultReviewForm);
  };

  const handleReviewImageChange = (event) => {
    const files = Array.from(event.target.files || []).slice(0, 3 - reviewForm.imagePreviews.length);
    if (!files.length) return;
    const imagePreviews = files.map((file) => ({ name: file.name, file, url: URL.createObjectURL(file) }));
    setReviewForm((prev) => ({
      ...prev,
      imagePreviews: [...prev.imagePreviews, ...imagePreviews].slice(0, 3)
    }));
    event.target.value = '';
  };

  const removeReviewImage = (index) => {
    setReviewForm((prev) => ({
      ...prev,
      imagePreviews: prev.imagePreviews.filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!reviewBooking || submitting) return;

    const missingRating = reviewCriteria.some((item) => Number(reviewForm[item.key]) < 1 || Number(reviewForm[item.key]) > 5);
    if (missingRating) {
      Swal.fire('Thiếu tiêu chí', 'Vui lòng chọn đầy đủ điểm đánh giá từ 1 đến 5 sao.', 'warning');
      return;
    }

    const normalizedComment = String(reviewForm.comment || '').trim();
    if (normalizedComment.length > 500) {
      Swal.fire(' Bình luận quá dài', ' Bình luận không được vượt quá 500 ký tự.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const uploadedImages = await uploadReviewImages(reviewForm.imagePreviews.map((image) => image.file).filter(Boolean));

      await axiosClient.post('/reviews', {
        bookingId: reviewBooking._id,
        fieldId: getFieldId(reviewBooking),
        rating: calculateReviewAverage(reviewForm),
        fieldQuality: reviewForm.fieldQuality,
        serviceQuality: reviewForm.serviceQuality,
        cleanliness: reviewForm.cleanliness,
        priceReasonable: reviewForm.priceReasonable,
        comment: normalizedComment,
        wouldRecommend: reviewForm.wouldRecommend,
        images: uploadedImages
      });
      closeReviewModal();
      await fetchBookings();
      Swal.fire({ icon: 'success', title: 'Đã gửi đánh giá', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Không thể gửi đánh giá', err.response?.data?.message || 'Vui lòng thử lại sau.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (value, size = 22, interactive = false, fieldKey = 'rating') => [1, 2, 3, 4, 5].map((starValue) => {
    const Icon = Number(value) >= starValue ? StarFill : Star;
    return (
      <button
        key={starValue}
        type="button"
        className={`rating-star-button ${Number(value) >= starValue ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
        disabled={!interactive}
        onClick={() => setReviewForm((prev) => ({ ...prev, [fieldKey]: starValue }))}
        aria-label={`${starValue} sao`}
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
              <p>Thu đổi bộ lọc hoặc đặt sân mới để bắt đầu quản lý lịch chơi của bạn.</p>
              <Button variant="success" href="/fields">Tìm sân ngay</Button>
            </Card.Body>
          </Card>
        ) : (
          <>
            <Row className="g-4">
              {paginatedBookings.map((booking) => {
                const field = getField(booking);
                const fieldId = getFieldId(booking);
                const bookingStatus = getBookingStatus(booking);
                const paymentStatus = getPaymentStatus(booking);
                const meta = statusMeta[bookingStatus] || statusMeta.pending;
                const canPay = paymentStatus === 'pending' && !['cancel_requested', 'cancelled', 'completed'].includes(bookingStatus);
                const canRequestCancel = ['pending', 'pending_payment', 'confirmed'].includes(bookingStatus);
                const isReviewed = Boolean(booking.review || booking.reviewed || booking.isReviewed || booking.reviewId);
                const canReview = bookingStatus === 'completed' && !isReviewed;
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
                          {bookingStatus === 'completed' && (
                            <Button variant={canReview ? 'success' : 'outline-secondary'} disabled={!canReview} onClick={() => openReviewModal(booking)}>
                              <MessageSquare size={16} /> {canReview ? 'Đánh giá' : 'Đã đánh giá'}
                            </Button>
                          )}
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                );
              })}
            </Row>

            {totalPages > 1 && (
              <div className="booking-pagination">
                <div>Hiển thị {paginatedBookings.length} / {visibleBookings.length} đơn</div>
                <div className="booking-pagination-controls">
                  <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}>Trang trước</button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button type="button" key={page} className={currentPage === page ? 'active' : ''} onClick={() => setCurrentPage(page)}>{page}</button>
                  ))}
                  <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}>Trang sau</button>
                </div>
              </div>
            )}
          </>
        )}
      </Container>

      <Modal show={Boolean(detailBooking)} onHide={() => setDetailBooking(null)} centered size="lg" dialogClassName="booking-detail-modal">
        <Modal.Header closeButton>
          <Modal.Title>Chi tiet booking</Modal.Title>
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

              <h5 className="detail-title">Chi tiết thanh toán</h5>
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

      <Modal show={Boolean(reviewBooking)} onHide={closeReviewModal} centered size="lg" dialogClassName="review-modal-dialog">
        <Form onSubmit={handleSubmitReview} className="review-modal-form">
          <Modal.Body className="review-experience-modal">
            <div className="review-modal-header">
              <div className="review-modal-title">
                <span><Sparkles size={20} /></span>
                <div>
                  <h3>Đánh giá trải nghiệm đặt sân</h3>
                  <p>Chia sẻ trải nghiệm của bạn để chúng tôi cải thiện dịch vụ tốt hơn</p>
                </div>
              </div>
              <button type="button" className="review-close-button" onClick={closeReviewModal} aria-label="Dong">
                <X size={20} />
              </button>
            </div>

            {reviewBooking && (
              <div className="review-booking-summary">
                <img src={getField(reviewBooking)?.image || '/image/football.jpg'} alt={getField(reviewBooking)?.fieldName || 'Sân bóng'} />
                <div>
                  <strong>{text(getField(reviewBooking)?.fieldName, 'Sân thể thao')}</strong>
                  <div className="review-booking-meta">
                    <span><CalendarCheck size={14} /> {formatDate(reviewBooking.date)}</span>
                    <span>{reviewBooking.startTime} - {reviewBooking.endTime}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="review-rating-grid">
              {reviewCriteria.map((criterion) => (
                <div className="review-criterion-card" key={criterion.key}>
                  <span>{criterion.label}</span>
                  <div className="review-stars-control">{renderStars(reviewForm[criterion.key], 20, true, criterion.key)}</div>
                </div>
              ))}
            </div>

            <div className="review-comment-area">
              <Form.Label>Bình luận của bạn</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                maxLength={500}
                value={reviewForm.comment}
                onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
                placeholder="Chia sẻ trải nghiệm thực tế của bạn..."
              />
              <span>{reviewForm.comment.length}/500</span>
            </div>

            <div className="review-recommend-section">
              <label>Bạn có muốn quay lại sân này không?</label>
              <div className="review-recommend-options">
                <button
                  type="button"
                  className={reviewForm.wouldRecommend ? 'active' : ''}
                  onClick={() => setReviewForm((prev) => ({ ...prev, wouldRecommend: true }))}
                >
                  <ThumbsUp size={17} /> Có, tôi sẽ quay lại
                </button>
                <button
                  type="button"
                  className={!reviewForm.wouldRecommend ? 'active muted' : ''}
                  onClick={() => setReviewForm((prev) => ({ ...prev, wouldRecommend: false }))}
                >
                  <ThumbsDown size={17} /> Không chắc
                </button>
              </div>
            </div>

            <div className="review-images-section">
              <label>Hình ảnh trải nghiệm (tối đa 3 ảnh)</label>
              <div className="review-image-grid">
                {reviewForm.imagePreviews.map((image, index) => (
                  <div className="review-image-preview" key={`${image.name}-${index}`}>
                    <img src={image.url} alt={image.name} />
                    <button type="button" onClick={() => removeReviewImage(index)}><X size={13} /></button>
                  </div>
                ))}
                {reviewForm.imagePreviews.length < 3 && (
                  <label className="review-image-upload">
                    <Camera size={20} />
                    <span>Thêm ảnh</span>
                    <input type="file" accept="image/*" multiple onChange={handleReviewImageChange} />
                  </label>
                )}
              </div>
            </div>

          </Modal.Body>
          <Modal.Footer className="review-modal-footer">
            <div className="review-helper-note">
              <Sparkles size={16} /> Đánh giá của bạn sẽ giúp cộng đồng người chơi có trải nghiệm tốt hơn!
            </div>
            <div className="review-footer-actions">
              <Button variant="light" onClick={closeReviewModal}>Hủy</Button>
              <Button type="submit" variant="success" disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : <><Send size={16} /> Gửi đánh giá</>}
              </Button>
            </div>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default MyBookingsPage;
