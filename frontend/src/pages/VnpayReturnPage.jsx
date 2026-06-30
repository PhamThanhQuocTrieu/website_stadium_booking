import React, { useEffect, useMemo, useState } from 'react';
import { Button, Container, Spinner } from 'react-bootstrap';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Home,
  ImageOff,
  ListChecks,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Timer,
  Trophy,
  User,
  Users,
  WalletCards,
  XCircle
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/VnpayReturnPage.css';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;
const text = (value, fallback = 'Chưa cập nhật') => value || fallback;
const normalize = (value) => String(value || '').trim().toLowerCase();

const paymentStatusMap = {
  pending: 'Chờ thanh toán',
  unpaid: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  success: 'Đã thanh toán',
  failed: 'Thanh toán thất bại',
  refunded: 'Đã hoàn tiền',
  cancelled: 'Thanh toán thất bại'
};

const bookingStatusMap = {
  pending: 'Chờ xử lý',
  pending_payment: 'Chờ thanh toán',
  confirmed: 'Đã xác nhận',
  playing: 'Đang diễn ra',
  completed: 'Hoàn thành',
  cancel_requested: 'Chờ xác nhận hủy',
  cancelled: 'Đã hủy',
  canceled: 'Đã hủy',
  refunded: 'Đã hoàn tiền'
};

const mapStatusLabel = (type, status) => {
  const source = type === 'paymentStatus' ? paymentStatusMap : bookingStatusMap;
  const key = normalize(status).replace(/\s+/g, '_');
  return source[key] || 'Không xác định';
};

const getField = (booking) => {
  const field = booking?.field || booking?.fieldId || {};
  return typeof field === 'object' && field !== null ? field : {};
};

const getFieldId = (booking) => {
  const rawField = booking?.field || booking?.fieldId;
  if (!rawField) return '';
  return typeof rawField === 'object' ? rawField._id || rawField.id || '' : rawField;
};

const getUser = (booking) => {
  const user = booking?.user || booking?.userId || booking?.customer || {};
  return typeof user === 'object' && user !== null ? user : {};
};

const getPaymentStatus = (booking, payment) => normalize(payment?.status || booking?.paymentStatus);
const getBookingStatus = (booking) => normalize(booking?.bookingStatus || booking?.status);
const isPaid = (booking, payment) => ['paid', 'success'].includes(getPaymentStatus(booking, payment));
const isCancelled = (booking) => ['cancelled', 'canceled'].includes(getBookingStatus(booking));
const isCompleted = (booking) => ['completed', 'da_hoan_thanh'].includes(getBookingStatus(booking).replace(/\s+/g, '_'));

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

const addMinutesToTime = (time, minutes) => {
  const [hour = 0, minute = 0] = String(time || '00:00').split(':').map(Number);
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const getTimeRange = (booking) => {
  if (booking?.startTime && booking?.endTime) return `${booking.startTime} - ${booking.endTime}`;
  const slots = booking?.slots || booking?.selectedSlots || [];
  if (Array.isArray(slots) && slots.length) return `${slots[0]} - ${addMinutesToTime(slots[slots.length - 1], 30)}`;
  return '-';
};

const getDuration = (booking) => {
  const slots = booking?.slots || booking?.selectedSlots || [];
  if (Array.isArray(slots) && slots.length) return `${slots.length * 30} phút`;
  if (!booking?.startTime || !booking?.endTime) return '-';
  const [startHour, startMinute] = booking.startTime.split(':').map(Number);
  const [endHour, endMinute] = booking.endTime.split(':').map(Number);
  const minutes = Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute));
  if (!minutes) return '-';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours ? `${hours} giờ` : ''}${rest ? ` ${rest} phút` : ''}`.trim();
};

const getTransactionCode = (booking, payment, query) => (
  payment?.txnRef ||
  payment?.transactionNo ||
  payment?.transactionId ||
  booking?.txnRef ||
  booking?.transactionId ||
  query.get('vnp_TxnRef') ||
  query.get('momoOrderId') ||
  '-'
);

const getServiceTotal = (booking) => {
  const services = Array.isArray(booking?.services) ? booking.services : [];
  return Number(booking?.serviceTotal || services.reduce((sum, item) => (
    sum + Number(item.total || Number(item.price || 0) * Number(item.quantity || 1))
  ), 0));
};

const buildBreakdown = (booking, payment) => {
  const serviceTotal = getServiceTotal(booking);
  const total = Number(payment?.amount || booking?.totalPrice || booking?.amount || 0);
  const discount = Number(booking?.discountAmount || 0);
  const fee = Number(booking?.transactionFee || 0);
  const fieldTotal = Math.max(0, Number(booking?.subtotal || total - serviceTotal + discount - fee));

  return [
    ['Tiền sân', fieldTotal],
    ['Dịch vụ đi kèm', serviceTotal],
    ['Giảm giá', discount ? -discount : 0],
    ['Phí giao dịch', fee],
    ['Tổng cộng', total]
  ];
};

const InfoPill = ({ icon: Icon, label, value }) => (
  <div className="success-info-pill">
    <span><Icon size={16} /></span>
    <div>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  </div>
);

const VnpayReturnPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const { data } = await axios.get(`http://localhost:5000/api/payments/vnpay/return${location.search}`);
        setResult(data);
      } catch (error) {
        setResult({
          success: false,
          message: error.response?.data?.message || 'Không thể xác minh giao dịch.'
        });
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [location.search]);

  const payment = result?.payment || result?.booking?.payment || {};
  const booking = result?.booking || {};
  const field = getField(booking);
  const fieldId = getFieldId(booking);
  const user = getUser(booking);
  const services = Array.isArray(booking?.services) ? booking.services : [];
  const success = Boolean(result?.success);
  const cancelled = isCancelled(booking);
  const paid = isPaid(booking, payment);
  const bookingStatus = getBookingStatus(booking);
  const paymentTime = payment?.paidAt || payment?.updatedAt || booking?.paidAt || booking?.updatedAt;
  const transactionCode = getTransactionCode(booking, payment, query);
  const breakdown = useMemo(() => buildBreakdown(booking, payment), [booking, payment]);

  const timeline = [
    { label: 'Đã đặt', time: formatDateTime(booking?.createdAt), active: Boolean(booking?._id), icon: ReceiptText },
    { label: 'Đã thanh toán', time: formatDateTime(paymentTime), active: paid, icon: CreditCard },
    {
      label: 'Chờ tới giờ chơi',
      time: `${formatDate(booking?.date)} - ${getTimeRange(booking)}`,
      active: ['confirmed', 'playing', 'completed'].includes(bookingStatus),
      icon: Clock3
    },
    { label: 'Hoàn thành', time: `${formatDate(booking?.date)} - ${text(booking?.endTime, '-')}`, active: isCompleted(booking), icon: Trophy }
  ];

  if (loading) {
    return (
      <div className="vnpay-return-page">
        <div className="success-loader">
          <Spinner animation="border" variant="success" />
          <h5>Đang xác minh thanh toán...</h5>
        </div>
      </div>
    );
  }

  return (
    <div className="vnpay-return-page">
      <Container className="success-container">
        <Button variant="light" className="success-back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={18} /> Trang chủ
        </Button>

        <section className={`success-hero ${success ? 'is-success' : 'is-failed'}`}>
          <div className="success-confetti" aria-hidden="true">
            <span /><span /><span /><span /><span /><span />
          </div>
          <div className="success-icon-ring">
            {success ? <Check size={38} /> : <XCircle size={38} />}
          </div>
          <h1>{success ? 'Đặt sân thành công!' : 'Giao dịch chưa thành công'}</h1>
          <p>
            {success
              ? 'Đơn đặt sân của bạn đã được xác nhận và thanh toán thành công.'
              : result?.message || 'Vui lòng thử lại hoặc liên hệ với sân để được hỗ trợ.'}
          </p>

          <div className="success-pills">
            <InfoPill icon={ReceiptText} label="Mã đơn" value={text(booking?._id || payment?.bookingId || query.get('vnp_TxnRef'), '-')} />
            <InfoPill icon={CalendarDays} label="Thời gian thanh toán" value={formatDateTime(paymentTime)} />
          </div>
        </section>

        {cancelled && (
          <div className="cancelled-alert">
            Trạng thái đơn hiện tại: {mapStatusLabel('bookingStatus', bookingStatus)}
          </div>
        )}

        <div className="success-main-grid">
          <section className="success-card booking-card">
            <div className="success-card-title">
              <ListChecks size={18} />
              <span>Thông tin đặt sân</span>
            </div>

            <div className="booking-summary">
              {field?.image ? (
                <img src={field.image} alt={text(field?.fieldName || field?.name, 'Sân thể thao')} />
              ) : (
                <div className="field-placeholder"><ImageOff size={30} /> Chưa có ảnh sân</div>
              )}

              <div className="booking-summary-content">
                <h2>{text(field?.fieldName || field?.name, 'Sân thể thao')}</h2>
                <p><MapPin size={15} /> {text(field?.address, 'Địa chỉ đang cập nhật')}</p>
                <div className="booking-facts">
                  <div><CalendarDays size={16} /><span>Ngày chơi</span><strong>{formatDate(booking?.date)}</strong></div>
                  <div><Clock3 size={16} /><span>Giờ chơi</span><strong>{getTimeRange(booking)}</strong></div>
                  <div><Timer size={16} /><span>Thời lượng</span><strong>{getDuration(booking)}</strong></div>
                  <div><Trophy size={16} /><span>Loại sân</span><strong>{text(field?.type, 'Chưa cập nhật')}</strong></div>
                  <div><ShieldCheck size={16} /><span>Mặt sân</span><strong>{text(field?.surface || field?.surfaceType, 'Chưa cập nhật')}</strong></div>
                  <div><Users size={16} /><span>Số người</span><strong>{text(field?.capacity || booking?.capacity, 'Chưa cập nhật')}</strong></div>
                </div>
              </div>
            </div>
          </section>

          <section className="success-card timeline-card">
            <div className="success-card-title">
              <CheckCircle2 size={18} />
              <span>Tiến trình đơn hàng</span>
            </div>

            {cancelled ? (
              <div className="cancelled-status"><XCircle size={18} /> Đã hủy</div>
            ) : (
              <div className="order-timeline">
                {timeline.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div className={`timeline-item ${step.active ? 'active' : ''}`} key={step.label}>
                      <div className="timeline-marker"><Icon size={14} /></div>
                      {index < timeline.length - 1 && <div className="timeline-line" />}
                      <div>
                        <strong>{step.label}</strong>
                        <span>{step.time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="success-detail-grid">
          <section className="success-card">
            <div className="success-card-title">
              <WalletCards size={18} />
              <span>Thanh toán</span>
            </div>
            <div className="payment-breakdown">
              {breakdown.map(([label, value], index) => (
                <div className={index === breakdown.length - 1 ? 'total' : ''} key={label}>
                  <span>{label}</span>
                  <strong>{money(value)}</strong>
                </div>
              ))}
            </div>
            <div className="payment-meta">
              <div><span>Phương thức thanh toán</span><strong>{text(payment?.method || booking?.paymentMethod, 'VNPAY')}</strong></div>
              <div><span>Trạng thái thanh toán</span><strong>{mapStatusLabel('paymentStatus', payment?.status || booking?.paymentStatus)}</strong></div>
              <div><span>Mã giao dịch</span><strong>{transactionCode}</strong></div>
            </div>
          </section>

          <section className="success-card">
            <div className="success-card-title">
              <ReceiptText size={18} />
              <span>Dịch vụ đi kèm</span>
            </div>
            {services.length ? (
              <div className="service-list">
                {services.map((service, index) => {
                  const quantity = Number(service.quantity || 1);
                  const price = Number(service.price || 0);
                  return (
                    <div className="service-row" key={service.serviceId || service._id || index}>
                      <div>
                        <strong>{text(service.name, 'Dịch vụ')}</strong>
                        <span>{quantity} x {money(price)}</span>
                      </div>
                      <b>{money(service.total || quantity * price)}</b>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">Không có dịch vụ đi kèm</div>
            )}
          </section>

          <section className="success-card">
            <div className="success-card-title">
              <User size={18} />
              <span>Thông tin người đặt</span>
            </div>
            <div className="customer-list">
              <div><User size={16} /><span>Họ tên</span><strong>{text(user?.fullName || user?.name || booking?.fullName)}</strong></div>
              <div><Phone size={16} /><span>Số điện thoại</span><strong>{text(user?.phone || booking?.phone)}</strong></div>
              <div><Mail size={16} /><span>Email</span><strong>{text(user?.email || booking?.email)}</strong></div>
            </div>
          </section>
        </div>

        <div className="success-actions">
          {fieldId && (
            <Button variant="outline-secondary" onClick={() => navigate(`/field-detail/${fieldId}`)}>
              Xem chi tiết sân
            </Button>
          )}
          <Button variant="success" onClick={() => navigate('/my-bookings')}>
            Xem lịch sử đặt sân
          </Button>
          {fieldId && (
            <Button className="btn-soft-success" onClick={() => navigate(`/booking/${fieldId}`)}>
              <RotateCcw size={16} /> Đặt lại sân này
            </Button>
          )}
          <Button variant="outline-secondary" onClick={() => navigate('/')}>
            <Home size={16} /> Về trang chủ
          </Button>
        </div>
      </Container>
    </div>
  );
};

export default VnpayReturnPage;

