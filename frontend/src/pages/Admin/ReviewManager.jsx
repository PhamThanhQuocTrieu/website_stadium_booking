import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Form, Modal, Pagination, Row, Spinner, Table } from 'react-bootstrap';
import { Eye, EyeOff, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import axiosClient from '../../api/axiosClient';
import '../../styles/admin/admin-common.css';

const ITEMS_PER_PAGE = 8;

const ReviewManager = () => {
  const [reviews, setReviews] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ fieldId: '', rating: '', from: '', to: '' });
  const [selectedReview, setSelectedReview] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(reviews.length / ITEMS_PER_PAGE));
  const paginatedReviews = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return reviews.slice(start, start + ITEMS_PER_PAGE);
  }, [reviews, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const fetchFields = async () => {
    const res = await axiosClient.get('/admin/fields');
    setFields(res.data || []);
  };

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const res = await axiosClient.get(`/reviews/admin?${params.toString()}`);
      setReviews(res.data || []);
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể tải đánh giá.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchReviews();
  }, [filters]);

  const getReviewRating = (review) => Number(review.overallRating ?? review.rating ?? 0);

  const renderStars = (rating) => {
    const score = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));

    return (
      <span className="d-inline-flex align-items-center gap-1" aria-label={`${score} sao`} title={`${score} sao`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            fill={star <= score ? 'currentColor' : 'none'}
            strokeWidth={2.4}
            aria-hidden="true"
          />
        ))}
      </span>
    );
  };

  const toggleReviewVisibility = async (review) => {
    const nextHidden = !review.isHidden;
    let hiddenReason = review.hiddenReason || '';

    if (nextHidden) {
      const result = await Swal.fire({
        title: 'Ẩn đánh giá?',
        input: 'text',
        inputLabel: 'Lý do ẩn',
        inputPlaceholder: 'Ví dụ: Nội dung vi phạm quy định',
        showCancelButton: true,
        confirmButtonText: 'Ẩn đánh giá',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#dc3545',
        inputValidator: (value) => (!String(value || '').trim() ? 'Vui lòng nhập lý do ẩn.' : null)
      });
      if (!result.isConfirmed) return;
      hiddenReason = result.value;
    } else {
      const result = await Swal.fire({
        title: 'Hiện lại đánh giá?',
        text: 'Đánh giá này sẽ hiện lại ở trang chi tiết sân.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Hiện lại',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#198754'
      });
      if (!result.isConfirmed) return;
    }

    try {
      const { data } = await axiosClient.patch(`/reviews/admin/${review._id}/visibility`, {
        isHidden: nextHidden,
        hiddenReason
      });
      setReviews((current) => current.map((item) => (item._id === review._id ? data.data : item)));
      setSelectedReview((current) => (current?._id === review._id ? data.data : current));
      Swal.fire({
        icon: 'success',
        title: nextHidden ? 'Đã ẩn đánh giá' : 'Đã hiện lại đánh giá',
        timer: 1400,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể cập nhật đánh giá.', 'error');
    }
  };

  return (
    <div>
      <div className="admin-page-heading">
        <div>
          <span>ARENAHUB ADMIN</span>
          <h1>Quản lý đánh giá</h1>
          <p>Xem chi tiết, lọc và ẩn các đánh giá vi phạm trong hệ thống.</p>
        </div>
        <Button variant="outline-success" onClick={fetchReviews}>Làm mới</Button>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={4}>
              <Form.Label className="small fw-bold">Sân</Form.Label>
              <Form.Select value={filters.fieldId} onChange={(e) => setFilters({ ...filters, fieldId: e.target.value })}>
                <option value="">Tất cả sân</option>
                {fields.map((field) => <option key={field._id} value={field._id}>{field.fieldName}</option>)}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="small fw-bold">Số sao</Form.Label>
              <Form.Select value={filters.rating} onChange={(e) => setFilters({ ...filters, rating: e.target.value })}>
                <option value="">Tất cả</option>
                {[5, 4, 3, 2, 1].map((star) => <option key={star} value={star}>{'★'.repeat(star)}</option>)}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Label className="small fw-bold">Từ ngày</Form.Label>
              <Form.Control type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            </Col>
            <Col md={3}>
              <Form.Label className="small fw-bold">Đến ngày</Form.Label>
              <Form.Control type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Body>
          {loading ? (
            <div className="text-center py-5"><Spinner animation="border" variant="success" /></div>
          ) : (
            <Table responsive hover className="align-middle">
              <thead>
                <tr>
                  <th>Người đánh giá</th>
                  <th>Sân</th>
                  <th>Sao</th>
                  <th>Nội dung</th>
                  <th>Trạng thái</th>
                  <th>Ngày</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedReviews.map((review) => (
                  <tr key={review._id} className={review.isHidden ? 'table-light' : ''}>
                    <td>
                      <div className="fw-bold">{review.user?.fullName || 'Người dùng'}</div>
                      <div className="text-muted small">{review.user?.email}</div>
                    </td>
                    <td>
                      {review.field?._id ? (
                        <Link className="text-success fw-semibold text-decoration-none" to={`/field-detail/${review.field._id}`}>
                          {review.field?.fieldName || '-'}
                        </Link>
                      ) : '-'}
                    </td>
                    <td><Badge bg="warning" text="dark">{renderStars(getReviewRating(review))}</Badge></td>
                    <td style={{ maxWidth: 360 }}>{review.comment}</td>
                    <td>
                      {review.isHidden ? (
                        <Badge bg="secondary">Đã ẩn</Badge>
                      ) : (
                        <Badge bg="success">Đang hiển thị</Badge>
                      )}
                    </td>
                    <td>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="text-end text-nowrap">
                      <Button variant="outline-success" size="sm" className="me-2" onClick={() => setSelectedReview(review)}>
                        <Eye size={16} />
                      </Button>
                      <Button
                        variant={review.isHidden ? 'outline-primary' : 'outline-secondary'}
                        size="sm"
                        onClick={() => toggleReviewVisibility(review)}
                      >
                        {review.isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                      </Button>
                    </td>
                  </tr>
                ))}
                {reviews.length === 0 && (
                  <tr><td colSpan="7" className="text-center text-muted py-4">Chưa có đánh giá phù hợp.</td></tr>
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
        {!loading && reviews.length > ITEMS_PER_PAGE && (
          <Card.Footer className="bg-white border-0 pt-0">
            <div className="admin-pagination-shell">
              <span>Hiển thị {paginatedReviews.length} / {reviews.length} đánh giá</span>
              <Pagination className="admin-pagination">
                <Pagination.Prev disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} />
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <Pagination.Item key={page} active={page === currentPage} onClick={() => setCurrentPage(page)}>
                    {page}
                  </Pagination.Item>
                ))}
                <Pagination.Next disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} />
              </Pagination>
            </div>
          </Card.Footer>
        )}
      </Card>

      <Modal show={Boolean(selectedReview)} onHide={() => setSelectedReview(null)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Chi tiết đánh giá</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedReview && (
            <div className="d-grid gap-3">
              <div className="d-flex justify-content-between align-items-start gap-3">
                <div>
                  <h5 className="fw-bold mb-1">{selectedReview.user?.fullName || 'Người dùng'}</h5>
                  <div className="text-muted small">{selectedReview.user?.email || '-'}</div>
                </div>
                {selectedReview.isHidden ? <Badge bg="secondary">Đã ẩn</Badge> : <Badge bg="success">Đang hiển thị</Badge>}
              </div>

              <Row className="g-3">
                <Col md={6}><strong>Sân:</strong> {selectedReview.field?.fieldName || '-'}</Col>
                <Col md={6}><strong>Ngày gửi:</strong> {new Date(selectedReview.createdAt).toLocaleString('vi-VN')}</Col>
                <Col md={6}><strong>Tổng thể:</strong> {renderStars(selectedReview.rating)}</Col>
                <Col md={6}><strong>Chất lượng sân:</strong> {renderStars(selectedReview.fieldQuality)}</Col>
                <Col md={6}><strong>Dịch vụ:</strong> {renderStars(selectedReview.serviceQuality)}</Col>
                <Col md={6}><strong>Vệ sinh:</strong> {renderStars(selectedReview.cleanliness)}</Col>
                <Col md={6}><strong>Giá cả:</strong> {renderStars(selectedReview.priceReasonable)}</Col>
                <Col md={6}><strong>Giới thiệu lại:</strong> {selectedReview.wouldRecommend ? 'Có' : 'Không'}</Col>
              </Row>

              <div>
                <strong>Nội dung:</strong>
                <p className="mb-0 mt-2 text-muted">{selectedReview.comment}</p>
              </div>

              {selectedReview.isHidden && (
                <div className="border rounded-3 p-3 bg-light">
                  <strong>Lý do ẩn:</strong>
                  <p className="mb-0 mt-1 text-muted">{selectedReview.hiddenReason || '-'}</p>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setSelectedReview(null)}>Đóng</Button>
          {selectedReview && (
            <Button variant={selectedReview.isHidden ? 'success' : 'secondary'} onClick={() => toggleReviewVisibility(selectedReview)}>
              {selectedReview.isHidden ? 'Hiện lại đánh giá' : 'Ẩn đánh giá'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ReviewManager;
