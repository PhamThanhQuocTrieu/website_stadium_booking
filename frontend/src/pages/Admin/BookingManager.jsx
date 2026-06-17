import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Form, Modal, Pagination, Row, Spinner, Table } from 'react-bootstrap';
import { Check, ChevronLeft, ChevronRight, Eye, RefreshCw, Search, X } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import '../../styles/admin/bookingmanager.css';

const paymentBadgeVariant = (status) => {
  const key = normalize(status);
  if (['paid', 'success'].includes(key)) return 'success';
  if (['pending', 'unpaid'].includes(key)) return 'warning';
  if (['failed', 'cancelled'].includes(key)) return 'danger';
  if (['refunded'].includes(key)) return 'secondary';
  return 'secondary';
};

const normalize = (value) => String(value || '').trim().toLowerCase();
const mapStatusLabel = (type, status) => {
  const key = normalize(status);
  const paymentLabels = {
    pending: 'Chờ thanh toán',
    unpaid: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    success: 'Đã thanh toán',
    failed: 'Thanh toán thất bại',
    refunded: 'Đã hoàn tiền',
    cancelled: 'Thanh toán thất bại'
  };
  const bookingLabels = {
    pending: 'Chờ xử lý',
    pending_payment: 'Chờ xử lý',
    confirmed: 'Đã xác nhận',
    playing: 'Đang diễn ra',
    completed: 'Hoàn thành',
    cancel_requested: 'Chờ xác nhận hủy',
    cancelled: 'Đã hủy',
    refunded: 'Đã hoàn tiền',
    'da hoan thanh': 'Hoàn thành'
  };
  return (type === 'paymentStatus' ? paymentLabels : bookingLabels)[key] || 'Không xác định';
};

const bookingBadgeVariant = (status) => {
  const key = normalize(status);
  if (key === 'cancel_requested') return 'warning';
  if (key === 'cancelled') return 'danger';
  if (key === 'completed' || key === 'da hoan thanh') return 'secondary';
  if (key === 'confirmed') return 'info';
  return 'warning';
};

const formatMoney = (amount) => Number(amount || 0).toLocaleString('vi-VN');
const formatDateTime = (value) => value ? new Date(value).toLocaleString('vi-VN') : '-';

const BookingManager = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalBookings, setTotalBookings] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    paymentStatus: '',
    paymentMethod: ''
  });

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append('page', page);
      params.append('limit', limit);
      const { data } = await axiosClient.get(`/bookings/admin/list?${params.toString()}`);
      setBookings(data.bookings || []);
      setTotalBookings(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [filters.status, filters.paymentStatus, filters.paymentMethod, page, limit]);

  const visibleBookings = useMemo(() => bookings, [bookings]);

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    if (page === 1) {
      fetchBookings();
      return;
    }
    setPage(1);
  };

  const handleLimitChange = (value) => {
    setPage(1);
    setLimit(Number(value));
  };

  const paginationItems = useMemo(() => {
    const maxVisiblePages = 5;
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(page - half, 1);
    const end = Math.min(start + maxVisiblePages - 1, totalPages);
    start = Math.max(end - maxVisiblePages + 1, 1);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, totalPages]);

  const updateCancelRequest = async (booking, action) => {
    const { data } = await axiosClient.patch(`/admin/bookings/${booking._id}/${action}-cancel`);
    setBookings((prev) => prev.map((item) => (
      item._id === booking._id ? { ...item, ...data.booking, field: item.field, fieldId: item.fieldId, user: item.user, userId: item.userId, payment: item.payment } : item
    )));
    if (selectedBooking?._id === booking._id) {
      setSelectedBooking((prev) => ({ ...prev, ...data.booking }));
    }
  };

  const paymentRows = selectedBooking?.payment ? [
    ['Provider', selectedBooking.payment.provider || '-'],
    ['Method', selectedBooking.payment.method || selectedBooking.paymentMethod || '-'],
    ['Amount', `${formatMoney(selectedBooking.payment.amount)} d`],
    ['TxnRef', selectedBooking.payment.txnRef || '-'],
    ['TransactionNo', selectedBooking.payment.transactionNo || '-'],
    ['BankCode', selectedBooking.payment.bankCode || '-'],
    ['ResponseCode', selectedBooking.payment.responseCode || '-'],
    ['TransactionStatus', selectedBooking.payment.transactionStatus || '-'],
    ['PaidAt', formatDateTime(selectedBooking.payment.paidAt)],
    ['Status', mapStatusLabel('paymentStatus', selectedBooking.payment.status || selectedBooking.paymentStatus)]
  ] : [];

  return (
    <div className="admin-booking-page">
      <div className="admin-booking-header">
        <div>
          <h3 className="fw-bold mb-1">Quản lý đơn đặt sân</h3>
          <p className="text-muted mb-0">Theo dõi booking và trạng thái thanh toán VNPAY.</p>
        </div>
        <Button variant="outline-success" onClick={fetchBookings}>
          <RefreshCw size={16} className="me-2" /> Làm mới
        </Button>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col lg={4}>
              <Form.Label className="small fw-bold text-muted">Tìm kiếm</Form.Label>
              <div className="admin-booking-search">
                <Search size={16} />
                <Form.Control
                  value={filters.search}
                  placeholder="Ten, SDT, ma don, txnRef..."
                  onChange={(event) => updateFilter('search', event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSearch();
                  }}
                />
                <Button variant="success" onClick={handleSearch}>Tìm</Button>
              </div>
            </Col>
            <Col sm={6} lg={2}>
              <Form.Label className="small fw-bold text-muted">Trạng thái đơn</Form.Label>
              <Form.Select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
                <option value="">Tất cả</option>
                <option value="pending">Chờ xử lý</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="cancel_requested">Chờ xác nhận hủy</option>
                <option value="completed">Hoàn thành</option>
                <option value="cancelled">Đã hủy</option>
              </Form.Select>
            </Col>
            <Col sm={6} lg={2}>
              <Form.Label className="small fw-bold text-muted">Thanh toán</Form.Label>
              <Form.Select value={filters.paymentStatus} onChange={(event) => updateFilter('paymentStatus', event.target.value)}>
                <option value="">Tất cả</option>
                <option value="pending">Chờ thanh toán</option>
                <option value="paid">Đã thanh toán</option>
                <option value="failed">Thanh toán thất bại</option>
                <option value="refunded">Đã hoàn tiền</option>
              </Form.Select>
            </Col>
            <Col sm={6} lg={2}>
              <Form.Label className="small fw-bold text-muted">Phương thức</Form.Label>
              <Form.Select value={filters.paymentMethod} onChange={(event) => updateFilter('paymentMethod', event.target.value)}>
                <option value="">Tất cả</option>
                <option value="VNPAY">VNPAY</option>
                <option value="VIETQR">VIETQR</option>
                <option value="CASH">CASH</option>
              </Form.Select>
            </Col>
            <Col sm={6} lg={2}>
              <Form.Label className="small fw-bold text-muted">Số đơn mỗi trang</Form.Label>
              <Form.Select value={limit} onChange={(event) => handleLimitChange(event.target.value)}>
                <option value="10">10 đơn</option>
                <option value="20">20 đơn</option>
                <option value="50">50 đơn</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5"><Spinner animation="border" variant="success" /></div>
          ) : (
            <div className="admin-booking-table-wrap">
              <Table hover responsive className="admin-booking-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách hàng</th>
                    <th>Sân</th>
                    <th>Lịch đặt</th>
                    <th>Trạng thái đơn</th>
                    <th>Phương thức</th>
                    <th>Trạng thái TT</th>
                    <th>TxnRef / GD</th>
                    <th>Số tiền TT</th>
                    <th>Thời gian TT</th>
                    <th className="admin-action-col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBookings.map((booking) => (
                    <tr key={booking._id}>
                      <td className="fw-bold text-success">{String(booking._id).slice(-8)}</td>
                      <td>
                        <div className="fw-semibold">{booking.user?.fullName || booking.userId?.fullName || '-'}</div>
                        <div className="text-muted small">{booking.user?.phone || booking.userId?.phone || booking.user?.email || '-'}</div>
                      </td>
                      <td>{booking.field?.fieldName || booking.fieldId?.fieldName || '-'}</td>
                      <td>
                        <div>{booking.date}</div>
                        <div className="text-muted small">{booking.startTime} - {booking.endTime}</div>
                      </td>
                      <td><Badge bg={bookingBadgeVariant(booking.status)}>{mapStatusLabel('bookingStatus', booking.status)}</Badge></td>
                      <td>{booking.payment?.method || booking.paymentMethod || '-'}</td>
                      <td><Badge bg={paymentBadgeVariant(booking.payment?.status || booking.paymentStatus)}>{mapStatusLabel('paymentStatus', booking.payment?.status || booking.paymentStatus)}</Badge></td>
                      <td>
                        <div className="txn-text">{booking.payment?.txnRef || '-'}</div>
                        <div className="text-muted small">{booking.payment?.transactionNo || '-'}</div>
                      </td>
                      <td>{formatMoney(booking.payment?.amount || booking.totalPrice)} d</td>
                      <td>{formatDateTime(booking.payment?.paidAt)}</td>
                      <td className="admin-action-cell">
                        {normalize(booking.status) === 'cancel_requested' && (
                          <div className="cancel-action-group">
                            <Button size="sm" variant="success" className="cancel-action-btn" onClick={() => updateCancelRequest(booking, 'approve')}>
                              <Check size={15} />
                              <span>Duyet huy</span>
                            </Button>
                            <Button size="sm" variant="outline-danger" className="cancel-action-btn" onClick={() => updateCancelRequest(booking, 'reject')}>
                              <X size={15} />
                              <span>Tu choi</span>
                            </Button>
                          </div>
                        )}
                        <Button size="sm" variant="light" className="detail-action-btn" onClick={() => setSelectedBooking(booking)}>
                          <Eye size={16} />
                          <span>Chi tiet</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {visibleBookings.length === 0 && (
                    <tr><td colSpan="11" className="text-center text-muted py-4">Không có booking phù hợp.</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
        {!loading && totalBookings > 0 && (
          <Card.Footer className="admin-booking-pagination-footer">
            <div className="admin-booking-page-summary">
              Hiển thị {((page - 1) * limit) + 1}-{Math.min(page * limit, totalBookings)} trong {totalBookings} đơn
            </div>
            <Pagination className="admin-booking-pagination mb-0">
              <Pagination.Prev disabled={page === 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
                <ChevronLeft size={16} />
              </Pagination.Prev>
              {paginationItems[0] > 1 && (
                <>
                  <Pagination.Item onClick={() => setPage(1)}>1</Pagination.Item>
                  {paginationItems[0] > 2 && <Pagination.Ellipsis disabled />}
                </>
              )}
              {paginationItems.map((item) => (
                <Pagination.Item key={item} active={item === page} onClick={() => setPage(item)}>
                  {item}
                </Pagination.Item>
              ))}
              {paginationItems[paginationItems.length - 1] < totalPages && (
                <>
                  {paginationItems[paginationItems.length - 1] < totalPages - 1 && <Pagination.Ellipsis disabled />}
                  <Pagination.Item onClick={() => setPage(totalPages)}>{totalPages}</Pagination.Item>
                </>
              )}
              <Pagination.Next disabled={page === totalPages} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>
                <ChevronRight size={16} />
              </Pagination.Next>
            </Pagination>
          </Card.Footer>
        )}
      </Card>

      <Modal show={!!selectedBooking} onHide={() => setSelectedBooking(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Chi tiet don dat san</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedBooking && (
            <>
              <Row className="g-3 mb-4">
                <Col md={6}><strong>Mã đơn:</strong> {selectedBooking._id}</Col>
                <Col md={6}><strong>Khách hàng:</strong> {selectedBooking.user?.fullName || selectedBooking.userId?.fullName || '-'}</Col>
                <Col md={6}><strong>Sân:</strong> {selectedBooking.field?.fieldName || selectedBooking.fieldId?.fieldName || '-'}</Col>
                <Col md={6}><strong>Thời gian:</strong> {selectedBooking.date} | {selectedBooking.startTime} - {selectedBooking.endTime}</Col>
                <Col md={6}><strong>Trạng thái đơn:</strong> {mapStatusLabel('bookingStatus', selectedBooking.status)}</Col>
                <Col md={6}><strong>Thanh toán:</strong> {mapStatusLabel('paymentStatus', selectedBooking.payment?.status || selectedBooking.paymentStatus)}</Col>
              </Row>

              <h6 className="fw-bold border-start border-4 border-success ps-2 mb-3">THÔNG TIN THANH TOÁN</h6>
              {normalize(selectedBooking.status) === 'cancel_requested' && (
                <div className="cancel-review-panel mb-4">
                  <div>
                    <strong>Yêu cầu hủy đang chờ xác nhận</strong>
                    <p className="mb-0 text-muted small">Admin cần duyệt để hủy đơn hoặc từ chối để đưa booking về trạng thái đã xác nhận.</p>
                  </div>
                  <div className="cancel-review-actions">
                    <Button variant="success" onClick={() => updateCancelRequest(selectedBooking, 'approve')}>
                      <Check size={16} /> Duyệt hủy
                    </Button>
                    <Button variant="outline-danger" onClick={() => updateCancelRequest(selectedBooking, 'reject')}>
                      <X size={16} /> Từ chối
                    </Button>
                  </div>
                </div>
              )}
              {paymentRows.length > 0 ? (
                <div className="payment-detail-grid">
                  {paymentRows.map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted">Booking chưa có giao dịch thanh toán.</div>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default BookingManager;
