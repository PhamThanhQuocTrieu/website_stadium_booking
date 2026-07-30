import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Form, Pagination, Row, Spinner, Table } from 'react-bootstrap';
import { BellRing, RefreshCcw, Send } from 'lucide-react';
import Swal from 'sweetalert2';
import axiosClient from '../../api/axiosClient';
import { formatNotificationText, notificationTypeLabels } from '../../utils/notificationUtils';
import '../../styles/admin/admin-common.css';
import '../../styles/admin/notificationmanager.css';

const initialForm = {
  userId: '',
  title: '',
  message: '',
  type: 'system'
};

const ITEMS_PER_PAGE = 8;

const AdminNotificationManager = () => {
  const [formData, setFormData] = useState(initialForm);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(notifications.length / ITEMS_PER_PAGE));
  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return notifications.slice(start, start + ITEMS_PER_PAGE);
  }, [notifications, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const fetchUsers = async () => {
    try {
      const { data } = await axiosClient.get('/users?limit=100&role=user');
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      console.error('Không thể tải danh sách user', error);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data } = await axiosClient.get('/admin/notifications?limit=50');
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể tải lịch sử thông báo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchHistory();
  }, []);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      return Swal.fire('Thiếu thông tin', 'Vui lòng nhập tiêu đề và nội dung thông báo.', 'warning');
    }

    setSending(true);
    try {
      const payload = {
        title: formData.title.trim(),
        message: formData.message.trim(),
        type: formData.type
      };
      if (formData.userId) payload.userId = formData.userId;

      const { data } = await axiosClient.post('/admin/notifications', payload);
      Swal.fire('Thành công', data.message || 'Đã gửi thông báo.', 'success');
      setFormData(initialForm);
      await fetchHistory();
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể gửi thông báo.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="admin-notification-page">
      <div className="admin-page-heading">
        <div>
          <span>ARENAHUB ADMIN</span>
          <h1>Quản lý thông báo</h1>
          <p>Gửi thông báo hệ thống, ưu đãi và theo dõi lịch sử gửi đến người dùng.</p>
        </div>
        <Button variant="outline-success" onClick={fetchHistory}>
          <RefreshCcw size={17} /> Làm mới
        </Button>
      </div>

      <Row className="g-4">
        <Col lg={5}>
          <Card className="admin-notification-card">
            <Card.Body>
              <div className="admin-notification-card-title">
                <BellRing size={20} />
                <h2>Gửi thông báo</h2>
              </div>

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Người nhận</Form.Label>
                  <Form.Select value={formData.userId} onChange={(event) => updateField('userId', event.target.value)}>
                    <option value="">Tất cả người dùng</option>
                    {users.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.fullName} - {user.email}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Loại thông báo</Form.Label>
                  <Form.Select value={formData.type} onChange={(event) => updateField('type', event.target.value)}>
                    <option value="system">Hệ thống</option>
                    <option value="promotion">Khuyến mãi</option>
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Tiêu đề</Form.Label>
                  <Form.Control
                    value={formData.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    placeholder="Nhập tiêu đề thông báo"
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>Nội dung</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={5}
                    value={formData.message}
                    onChange={(event) => updateField('message', event.target.value)}
                    placeholder="Nhập nội dung thông báo"
                  />
                </Form.Group>

                <Button type="submit" className="admin-notification-send" disabled={sending}>
                  {sending ? <Spinner animation="border" size="sm" /> : <><Send size={17} /> Gửi thông báo</>}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={7}>
          <Card className="admin-notification-card">
            <Card.Body>
              <div className="admin-notification-card-title">
                <BellRing size={20} />
                <h2>Lịch sử thông báo</h2>
              </div>

              {loading ? (
                <div className="admin-notification-state">
                  <Spinner animation="border" variant="success" />
                </div>
              ) : (
                <div className="admin-notification-table-wrap">
                  <Table hover responsive className="admin-notification-table align-middle">
                    <thead>
                      <tr>
                        <th>Người nhận</th>
                        <th>Tiêu đề</th>
                        <th>Loại</th>
                        <th>Trạng thái</th>
                        <th>Ngày gửi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedNotifications.map((notification) => (
                        <tr key={notification._id}>
                          <td>
                            <strong>{notification.user?.fullName || 'Người dùng'}</strong>
                            <span>{notification.user?.email}</span>
                          </td>
                          <td>
                            <strong>{formatNotificationText(notification.title)}</strong>
                            <span>{formatNotificationText(notification.message)}</span>
                          </td>
                          <td>{notificationTypeLabels[notification.type] || notification.type}</td>
                          <td>
                            <Badge bg={notification.isRead ? 'secondary' : 'success'}>
                              {notification.isRead ? 'Đã đọc' : 'Chưa đọc'}
                            </Badge>
                          </td>
                          <td>{new Date(notification.createdAt).toLocaleString('vi-VN')}</td>
                        </tr>
                      ))}
                      {notifications.length === 0 && (
                        <tr>
                          <td colSpan="5" className="text-center text-muted py-4">Chưa có thông báo.</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                  {notifications.length > ITEMS_PER_PAGE && (
                    <div className="admin-pagination-shell">
                      <span>Hiển thị {paginatedNotifications.length} / {notifications.length} thông báo</span>
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
                  )}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminNotificationManager;
