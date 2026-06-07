import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, Col, Form, Row, Spinner, Table } from 'react-bootstrap';
import { Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import axiosClient from '../../api/axiosClient';

const ReviewManager = () => {
  const [reviews, setReviews] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ fieldId: '', rating: '', from: '', to: '' });

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
    fetchReviews();
  }, [filters]);

  const deleteReview = async (review) => {
    const result = await Swal.fire({
      title: 'Xóa đánh giá?',
      text: 'Admin chỉ nên xóa đánh giá vi phạm.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#dc3545'
    });
    if (!result.isConfirmed) return;

    try {
      await axiosClient.delete(`/reviews/${review._id}`);
      await fetchReviews();
      Swal.fire('Đã xóa', 'Đánh giá đã được xóa.', 'success');
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể xóa đánh giá.', 'error');
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-1">Quản lý đánh giá</h4>
          <p className="text-muted mb-0">Xem, lọc và xóa các đánh giá vi phạm.</p>
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
                {[5, 4, 3, 2, 1].map((star) => <option key={star} value={star}>{star} sao</option>)}
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
                  <th>Ngày</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review._id}>
                    <td>
                      <div className="fw-bold">{review.user?.fullName || 'Người dùng'}</div>
                      <div className="text-muted small">{review.user?.email}</div>
                    </td>
                    <td>{review.field?.fieldName || '-'}</td>
                    <td><Badge bg="warning" text="dark">{review.rating} sao</Badge></td>
                    <td style={{ maxWidth: 360 }}>{review.comment}</td>
                    <td>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="text-end">
                      <Button variant="outline-danger" size="sm" onClick={() => deleteReview(review)}>
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
                {reviews.length === 0 && (
                  <tr><td colSpan="6" className="text-center text-muted py-4">Chưa có đánh giá phù hợp.</td></tr>
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default ReviewManager;
