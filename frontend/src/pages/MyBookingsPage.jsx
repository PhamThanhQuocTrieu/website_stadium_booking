import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Container, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { CalendarCheck, Edit3, MessageSquare, Trash2 } from 'lucide-react';
import { Star, StarFill } from 'react-bootstrap-icons';
import Swal from 'sweetalert2';
import axiosClient from '../api/axiosClient';
import '../styles/MyBookingsPage.css';

const completedStatuses = ['Completed', 'Đã hoàn thành', 'Da hoan thanh'];

const MyBookingsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/bookings/my-bookings');
      setBookings(res.data || []);
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể tải lịch sử đặt sân.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const selectedReview = selectedBooking?.review || null;
  const modalTitle = selectedReview ? 'Sửa đánh giá' : 'Đánh giá sân';

  const stats = useMemo(() => {
    return {
      total: bookings.length,
      completed: bookings.filter((booking) => completedStatuses.includes(booking.status)).length,
      reviewed: bookings.filter((booking) => booking.review).length
    };
  }, [bookings]);

  const openReviewModal = (booking) => {
    setSelectedBooking(booking);
    setReviewForm({
      rating: booking.review?.rating || 5,
      comment: booking.review?.comment || ''
    });
    setShowModal(true);
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!selectedBooking || submitting) return;
    if (!String(reviewForm.comment || '').trim()) {
      Swal.fire('Thiếu bình luận', 'Vui lòng nhập nội dung đánh giá.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      if (selectedReview) {
        await axiosClient.put(`/reviews/${selectedReview._id}`, reviewForm);
      } else {
        await axiosClient.post('/reviews', {
          bookingId: selectedBooking._id,
          fieldId: selectedBooking.fieldId?._id || selectedBooking.field?._id || selectedBooking.field,
          rating: reviewForm.rating,
          comment: reviewForm.comment
        });
      }

      setShowModal(false);
      await fetchBookings();
      Swal.fire('Thành công', selectedReview ? 'Đã cập nhật đánh giá.' : 'Đã gửi đánh giá của bạn.', 'success');
    } catch (error) {
      Swal.fire('Không thể gửi đánh giá', error.response?.data?.message || 'Vui lòng thử lại sau.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (booking) => {
    if (!booking.review) return;
    const result = await Swal.fire({
      title: 'Xóa đánh giá?',
      text: 'Bạn có thể đánh giá lại booking này sau khi xóa.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#dc3545'
    });

    if (!result.isConfirmed) return;

    try {
      await axiosClient.delete(`/reviews/${booking.review._id}`);
      await fetchBookings();
      Swal.fire('Đã xóa', 'Đánh giá đã được xóa.', 'success');
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể xóa đánh giá.', 'error');
    }
  };

  const renderStars = (value, size = 22, interactive = false) => {
    return [1, 2, 3, 4, 5].map((starValue) => {
      const filled = Number(value) >= starValue;
      const Icon = filled ? StarFill : Star;
      return (
        <button
          key={starValue}
          type="button"
          className={`rating-star-button ${filled ? 'filled' : 'empty'} ${interactive ? 'interactive' : ''}`}
          disabled={!interactive}
          onClick={() => setReviewForm((prev) => ({ ...prev, rating: starValue }))}
        >
          <Icon size={size} />
        </button>
      );
    });
  };

  if (loading) {
    return (
      <div className="vh-100 d-flex align-items-center justify-content-center">
        <Spinner animation="border" variant="success" />
      </div>
    );
  }

  return (
    <div className="my-bookings-page bg-light min-vh-100 py-5">
      <Container>
        <div className="my-bookings-header d-flex align-items-center justify-content-between mb-4">
          <div>
            <h3 className="fw-bold mb-1">Lịch sử đặt sân</h3>
            <p className="text-muted mb-0">Đánh giá sân sau khi booking đã hoàn thành.</p>
          </div>
          <Button variant="outline-success" onClick={fetchBookings}>Làm mới</Button>
        </div>

        <Row className="g-3 mb-4">
          <Col md={4}><Card className="border-0 shadow-sm"><Card.Body><div className="text-muted small">Tổng booking</div><h3 className="mb-0 text-success">{stats.total}</h3></Card.Body></Card></Col>
          <Col md={4}><Card className="border-0 shadow-sm"><Card.Body><div className="text-muted small">Đã hoàn thành</div><h3 className="mb-0 text-success">{stats.completed}</h3></Card.Body></Card></Col>
          <Col md={4}><Card className="border-0 shadow-sm"><Card.Body><div className="text-muted small">Đã đánh giá</div><h3 className="mb-0 text-success">{stats.reviewed}</h3></Card.Body></Card></Col>
        </Row>

        {bookings.length === 0 ? (
          <Card className="border-0 shadow-sm text-center p-5">
            <CalendarCheck className="mx-auto text-success mb-3" size={42} />
            <h5 className="fw-bold">Bạn chưa có booking nào</h5>
          </Card>
        ) : (
          <Row className="g-4">
            {bookings.map((booking) => {
              const field = booking.fieldId || booking.field;
              const canReview = completedStatuses.includes(booking.status);
              return (
                <Col lg={6} key={booking._id}>
                  <Card className="booking-history-card border-0 shadow-sm h-100">
                    <Card.Body className="p-4">
                      <div className="booking-card-heading d-flex justify-content-between gap-3 mb-3">
                        <div>
                          <h5 className="fw-bold mb-1">{field?.fieldName || 'Sân thể thao'}</h5>
                          <div className="text-muted small">{field?.address}</div>
                        </div>
                        <Badge bg={canReview ? 'success' : booking.status === 'Cancelled' ? 'danger' : 'secondary'} className="h-25">
                          {booking.status}
                        </Badge>
                      </div>

                      <div className="small text-muted mb-2">Ngày: <b>{booking.date}</b></div>
                      <div className="small text-muted mb-2">Giờ: <b>{booking.startTime} - {booking.endTime}</b></div>
                      <div className="small text-muted mb-3">Tổng tiền: <b>{Number(booking.totalPrice || 0).toLocaleString('vi-VN')}đ</b></div>

                      {booking.review && (
                        <div className="bg-light rounded-3 p-3 mb-3">
                          <div className="rating-stars text-warning mb-1">{renderStars(booking.review.rating, 16)}</div>
                          <div className="small text-muted">{booking.review.comment}</div>
                        </div>
                      )}

                      <div className="booking-card-actions d-flex gap-2">
                        <Button
                          variant={booking.review ? 'outline-success' : 'success'}
                          disabled={!canReview}
                          onClick={() => openReviewModal(booking)}
                        >
                          {booking.review ? <Edit3 size={16} className="me-2" /> : <MessageSquare size={16} className="me-2" />}
                          {booking.review ? 'Sửa đánh giá' : 'Đánh giá'}
                        </Button>
                        {booking.review && (
                          <Button variant="outline-danger" onClick={() => handleDeleteReview(booking)}>
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                      {!canReview && <div className="text-muted small mt-2">Chỉ booking đã hoàn thành mới được đánh giá.</div>}
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Container>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered dialogClassName="review-modal-dialog">
        <Modal.Header closeButton>
          <Modal.Title>{modalTitle}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitReview}>
          <Modal.Body>
            <div className="mb-3">
              <div className="small fw-bold text-muted mb-2">Số sao</div>
              <div className="rating-stars text-warning">{renderStars(reviewForm.rating, 30, true)}</div>
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
            <Button variant="light" onClick={() => setShowModal(false)}>Hủy</Button>
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
