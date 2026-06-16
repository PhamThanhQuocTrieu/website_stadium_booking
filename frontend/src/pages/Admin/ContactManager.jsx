import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Eye, Mail, RefreshCcw, Search, Send, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import axiosClient from '../../api/axiosClient';
import '../../styles/admin/contactmanager.css';

const categoryLabels = {
  booking_support: 'Hỗ trợ đặt sân',
  payment_support: 'Hỗ trợ thanh toán',
  cancel_request: 'Yêu cầu hủy sân',
  complaint: 'Khiếu nại / góp ý',
  system_error: 'Báo lỗi hệ thống',
  other: 'Khác'
};

const statusLabels = {
  new: 'Mới gửi',
  processing: 'Đang xử lý',
  replied: 'Đã phản hồi',
  closed: 'Đã đóng'
};

const categoryOptions = Object.entries(categoryLabels).map(([value, label]) => ({ value, label }));
const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN');
};

const ContactManager = () => {
  const [contacts, setContacts] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', category: '' });
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const activeFilterCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);

  const fetchContacts = async (page = pagination.page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const { data } = await axiosClient.get(`/contacts?${params.toString()}`);
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
      setPagination({
        page: data.page || page,
        total: data.total || 0,
        totalPages: data.totalPages || 1
      });
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể tải danh sách liên hệ.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts(1);
  }, [filters]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ search: '', status: '', category: '' });
  };

  const openDetail = async (contact) => {
    setShowModal(true);
    setDetailLoading(true);
    setSelectedContact(contact);
    setReplyText(contact.adminReply || '');
    try {
      const { data } = await axiosClient.get(`/contacts/${contact._id}`);
      setSelectedContact(data);
      setReplyText(data.adminReply || '');
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể tải chi tiết liên hệ.', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedContact(null);
    setReplyText('');
  };

  const changeStatus = async (contactId, status) => {
    try {
      const { data } = await axiosClient.patch(`/contacts/${contactId}/status`, { status });
      setContacts((prev) => prev.map((item) => (item._id === contactId ? data : item)));
      setSelectedContact((prev) => (prev?._id === contactId ? data : prev));
      Swal.fire('Thành công', 'Đã cập nhật trạng thái liên hệ.', 'success');
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể cập nhật trạng thái.', 'error');
    }
  };

  const sendReply = async () => {
    if (!selectedContact?._id) return;
    if (!replyText.trim()) {
      return Swal.fire('Thiếu nội dung', 'Vui lòng nhập nội dung phản hồi.', 'warning');
    }

    setReplying(true);
    try {
      const { data } = await axiosClient.patch(`/contacts/${selectedContact._id}/reply`, {
        adminReply: replyText.trim()
      });
      setSelectedContact(data);
      setContacts((prev) => prev.map((item) => (item._id === data._id ? data : item)));
      Swal.fire('Thành công', 'Đã lưu phản hồi admin.', 'success');
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể gửi phản hồi.', 'error');
    } finally {
      setReplying(false);
    }
  };

  const deleteContact = async (contact) => {
    const result = await Swal.fire({
      title: 'Xóa liên hệ?',
      text: `Liên hệ của ${contact.fullName} sẽ bị xóa khỏi hệ thống.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#dc2626'
    });
    if (!result.isConfirmed) return;

    try {
      await axiosClient.delete(`/contacts/${contact._id}`);
      await fetchContacts(pagination.page);
      if (selectedContact?._id === contact._id) closeModal();
      Swal.fire('Đã xóa', 'Liên hệ đã được xóa.', 'success');
    } catch (error) {
      Swal.fire('Lỗi', error.response?.data?.message || 'Không thể xóa liên hệ.', 'error');
    }
  };

  return (
    <div className="contact-manager-page">
      <div className="contact-manager-header">
        <div>
          <span>ARENAHUB ADMIN</span>
          <h1>Quản lý liên hệ</h1>
          <p>Theo dõi, xử lý và phản hồi yêu cầu hỗ trợ từ người dùng.</p>
        </div>
        <Button variant="outline-success" onClick={() => fetchContacts(pagination.page)}>
          <RefreshCcw size={17} /> Làm mới
        </Button>
      </div>

      <Card className="contact-filter-card">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col lg={5}>
              <Form.Label>Tìm kiếm</Form.Label>
              <div className="contact-search-input">
                <Search size={17} />
                <Form.Control
                  value={filters.search}
                  onChange={(event) => updateFilter('search', event.target.value)}
                  placeholder="Tên, email, số điện thoại hoặc chủ đề"
                />
              </div>
            </Col>
            <Col md={6} lg={3}>
              <Form.Label>Trạng thái</Form.Label>
              <Form.Select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
                <option value="">Tất cả trạng thái</option>
                {statusOptions.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={6} lg={3}>
              <Form.Label>Loại yêu cầu</Form.Label>
              <Form.Select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}>
                <option value="">Tất cả loại</option>
                {categoryOptions.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </Form.Select>
            </Col>
            <Col lg={1}>
              <Button variant="light" className="contact-reset-btn" onClick={resetFilters} disabled={!activeFilterCount}>
                Reset
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="contact-table-card">
        <Card.Body>
          {loading ? (
            <div className="contact-manager-state">
              <Spinner animation="border" variant="success" />
              <p>Đang tải danh sách liên hệ...</p>
            </div>
          ) : (
            <>
              <div className="contact-table-wrap">
                <Table hover responsive className="contact-admin-table align-middle">
                  <thead>
                    <tr>
                      <th>Người gửi</th>
                      <th>Email</th>
                      <th>Số điện thoại</th>
                      <th>Loại yêu cầu</th>
                      <th>Chủ đề</th>
                      <th>Trạng thái</th>
                      <th>Ngày gửi</th>
                      <th className="text-end">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr key={contact._id}>
                        <td><strong>{contact.fullName}</strong></td>
                        <td>{contact.email}</td>
                        <td>{contact.phone}</td>
                        <td>{categoryLabels[contact.category] || contact.category}</td>
                        <td className="contact-subject-cell">{contact.subject}</td>
                        <td>
                          <Badge className={`contact-status-badge status-${contact.status}`}>
                            {statusLabels[contact.status] || contact.status}
                          </Badge>
                        </td>
                        <td>{formatDateTime(contact.createdAt)}</td>
                        <td className="text-end">
                          <div className="contact-action-group">
                            <Button variant="outline-success" size="sm" onClick={() => openDetail(contact)} title="Xem chi tiết">
                              <Eye size={16} />
                            </Button>
                            <Button variant="outline-danger" size="sm" onClick={() => deleteContact(contact)} title="Xóa liên hệ">
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {contacts.length === 0 && (
                      <tr>
                        <td colSpan="8" className="text-center text-muted py-5">Chưa có liên hệ phù hợp.</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>

              <div className="contact-pagination">
                <span>
                  Tổng {pagination.total} liên hệ - Trang {pagination.page}/{pagination.totalPages}
                </span>
                <div>
                  <Button
                    variant="outline-secondary"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchContacts(pagination.page - 1)}
                  >
                    Trang trước
                  </Button>
                  <Button
                    variant="outline-secondary"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchContacts(pagination.page + 1)}
                  >
                    Trang sau
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={closeModal} size="lg" centered className="contact-detail-modal">
        <Modal.Header closeButton>
          <Modal.Title><Mail size={20} /> Chi tiết liên hệ</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailLoading || !selectedContact ? (
            <div className="contact-manager-state compact">
              <Spinner animation="border" variant="success" />
            </div>
          ) : (
            <>
              <div className="contact-detail-grid">
                <div>
                  <span>Họ tên</span>
                  <strong>{selectedContact.fullName}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{selectedContact.email}</strong>
                </div>
                <div>
                  <span>Số điện thoại</span>
                  <strong>{selectedContact.phone}</strong>
                </div>
                <div>
                  <span>Loại yêu cầu</span>
                  <strong>{categoryLabels[selectedContact.category] || selectedContact.category}</strong>
                </div>
                <div>
                  <span>Trạng thái</span>
                  <Form.Select
                    value={selectedContact.status}
                    onChange={(event) => changeStatus(selectedContact._id, event.target.value)}
                  >
                    {statusOptions.map((option) => (
                      <option value={option.value} key={option.value}>{option.label}</option>
                    ))}
                  </Form.Select>
                </div>
                <div>
                  <span>Ngày gửi</span>
                  <strong>{formatDateTime(selectedContact.createdAt)}</strong>
                </div>
              </div>

              <div className="contact-detail-block">
                <span>Chủ đề</span>
                <strong>{selectedContact.subject}</strong>
              </div>

              <div className="contact-detail-block">
                <span>Nội dung</span>
                <p>{selectedContact.message}</p>
              </div>

              {selectedContact.adminReply && (
                <div className="contact-detail-block is-reply">
                  <span>Phản hồi admin</span>
                  <p>{selectedContact.adminReply}</p>
                  <small>Thời gian phản hồi: {formatDateTime(selectedContact.repliedAt)}</small>
                </div>
              )}

              <Form.Group className="contact-reply-box">
                <Form.Label>Nội dung phản hồi</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Nhập nội dung phản hồi cho liên hệ này"
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={closeModal}>Đóng</Button>
          <Button className="contact-reply-btn" onClick={sendReply} disabled={replying || detailLoading || !selectedContact}>
            {replying ? <Spinner animation="border" size="sm" /> : <><Send size={17} /> Gửi phản hồi</>}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ContactManager;
