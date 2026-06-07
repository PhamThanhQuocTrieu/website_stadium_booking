import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Eye, RefreshCw, Search } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import '../../styles/admin/bookingmanager.css';

const paymentBadgeVariant = (status) => {
  if (['PAID', 'SUCCESS', 'Paid'].includes(status)) return 'success';
  if (['PENDING', 'Pending'].includes(status)) return 'warning';
  if (['FAILED'].includes(status)) return 'danger';
  if (['REFUNDED', 'CANCELLED'].includes(status)) return 'secondary';
  return 'secondary';
};

const formatMoney = (amount) => Number(amount || 0).toLocaleString('vi-VN');
const formatDateTime = (value) => value ? new Date(value).toLocaleString('vi-VN') : '-';

const BookingManager = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
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
      const { data } = await axiosClient.get(`/bookings/admin/list?${params.toString()}`);
      setBookings(data.bookings || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [filters.status, filters.paymentStatus, filters.paymentMethod]);

  const visibleBookings = useMemo(() => bookings, [bookings]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
    ['Status', selectedBooking.payment.status || '-']
  ] : [];

  return (
    <div className="admin-booking-page">
      <div className="admin-booking-header">
        <div>
          <h3 className="fw-bold mb-1">Quan ly don dat san</h3>
          <p className="text-muted mb-0">Theo doi booking va trang thai thanh toan VNPAY.</p>
        </div>
        <Button variant="outline-success" onClick={fetchBookings}>
          <RefreshCw size={16} className="me-2" /> Lam moi
        </Button>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col lg={4}>
              <Form.Label className="small fw-bold text-muted">Tim kiem</Form.Label>
              <div className="admin-booking-search">
                <Search size={16} />
                <Form.Control
                  value={filters.search}
                  placeholder="Ten, SDT, ma don, txnRef..."
                  onChange={(event) => updateFilter('search', event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') fetchBookings();
                  }}
                />
                <Button variant="success" onClick={fetchBookings}>Tim</Button>
              </div>
            </Col>
            <Col sm={6} lg={2}>
              <Form.Label className="small fw-bold text-muted">Trang thai don</Form.Label>
              <Form.Select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
                <option value="">Tat ca</option>
                <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="Confirmed">Confirmed</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="Cancelled">Cancelled</option>
              </Form.Select>
            </Col>
            <Col sm={6} lg={2}>
              <Form.Label className="small fw-bold text-muted">Thanh toan</Form.Label>
              <Form.Select value={filters.paymentStatus} onChange={(event) => updateFilter('paymentStatus', event.target.value)}>
                <option value="">Tat ca</option>
                <option value="UNPAID">UNPAID</option>
                <option value="PENDING">PENDING</option>
                <option value="PAID">PAID</option>
                <option value="FAILED">FAILED</option>
                <option value="REFUNDED">REFUNDED</option>
              </Form.Select>
            </Col>
            <Col sm={6} lg={2}>
              <Form.Label className="small fw-bold text-muted">Phuong thuc</Form.Label>
              <Form.Select value={filters.paymentMethod} onChange={(event) => updateFilter('paymentMethod', event.target.value)}>
                <option value="">Tat ca</option>
                <option value="VNPAY">VNPAY</option>
                <option value="VIETQR">VIETQR</option>
                <option value="CASH">CASH</option>
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
                    <th>Ma don</th>
                    <th>Khach hang</th>
                    <th>San</th>
                    <th>Lich dat</th>
                    <th>Trang thai don</th>
                    <th>Phuong thuc</th>
                    <th>Trang thai TT</th>
                    <th>TxnRef / GD</th>
                    <th>So tien TT</th>
                    <th>Thoi gian TT</th>
                    <th></th>
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
                      <td><Badge bg="info">{booking.status}</Badge></td>
                      <td>{booking.payment?.method || booking.paymentMethod || '-'}</td>
                      <td><Badge bg={paymentBadgeVariant(booking.payment?.status || booking.paymentStatus)}>{booking.payment?.status || booking.paymentStatus}</Badge></td>
                      <td>
                        <div className="txn-text">{booking.payment?.txnRef || '-'}</div>
                        <div className="text-muted small">{booking.payment?.transactionNo || '-'}</div>
                      </td>
                      <td>{formatMoney(booking.payment?.amount || booking.totalPrice)} d</td>
                      <td>{formatDateTime(booking.payment?.paidAt)}</td>
                      <td className="text-end">
                        <Button size="sm" variant="light" onClick={() => setSelectedBooking(booking)}>
                          <Eye size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {visibleBookings.length === 0 && (
                    <tr><td colSpan="11" className="text-center text-muted py-4">Khong co booking phu hop.</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={!!selectedBooking} onHide={() => setSelectedBooking(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Chi tiet don dat san</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedBooking && (
            <>
              <Row className="g-3 mb-4">
                <Col md={6}><strong>Ma don:</strong> {selectedBooking._id}</Col>
                <Col md={6}><strong>Khach hang:</strong> {selectedBooking.user?.fullName || selectedBooking.userId?.fullName || '-'}</Col>
                <Col md={6}><strong>San:</strong> {selectedBooking.field?.fieldName || selectedBooking.fieldId?.fieldName || '-'}</Col>
                <Col md={6}><strong>Thoi gian:</strong> {selectedBooking.date} | {selectedBooking.startTime} - {selectedBooking.endTime}</Col>
              </Row>

              <h6 className="fw-bold border-start border-4 border-success ps-2 mb-3">THONG TIN THANH TOAN</h6>
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
                <div className="text-muted">Booking chua co giao dich thanh toan.</div>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default BookingManager;
