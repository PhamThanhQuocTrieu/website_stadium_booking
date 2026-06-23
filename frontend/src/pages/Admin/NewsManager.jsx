import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Modal,
  Row,
  Spinner,
  Table
} from 'react-bootstrap';
import {
  Edit3,
  ExternalLink,
  FileText,
  Inbox,
  Newspaper,
  Plus,
  Search,
  Trash2
} from 'lucide-react';
import Swal from 'sweetalert2';
import axiosClient from '../../api/axiosClient';
import socket from '../../socket';
import '../../styles/admin/admin-common.css';
import '../../styles/admin/newsmanager.css';

const emptyForm = {
  title: '',
  summary: '',
  content: '',
  thumbnail: '',
  category: 'Tin tức chung',
  tags: '',
  newsType: 'internal',
  sourceName: '',
  sourceUrl: '',
  originalAuthor: '',
  status: 'draft',
  isFeatured: false
};

const categories = [
  'Khuyến mãi',
  'Hướng dẫn đặt sân',
  'Sự kiện thể thao',
  'Thông báo hệ thống',
  'Tin tức chung'
];

const statusLabels = {
  draft: 'Bản nháp',
  published: 'Đã xuất bản',
  hidden: 'Đã ẩn'
};

const newsTypeLabels = {
  internal: 'Tin nội bộ',
  external: 'Tin nguồn ngoài'
};

const isValidUrl = (value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('vi-VN');
};

const NewsManager = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadNews = async () => {
    try {
      setLoading(true);
      const params = typeFilter === 'all' ? {} : { newsType: typeFilter };
      const { data } = await axiosClient.get('/news/admin/all', { params });
      setNews(Array.isArray(data) ? data : data.news || []);
    } catch (err) {
      Swal.fire('Lỗi', err.response?.data?.message || 'Không thể tải danh sách tin tức.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
    if (!socket.connected) socket.connect();
    socket.on('news_updated', loadNews);
    return () => socket.off('news_updated', loadNews);
  }, [typeFilter]);

  const filteredNews = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return news.filter((item) => {
      const matchesKeyword = !keyword || [item.title, item.summary, item.category, item.sourceName]
        .some((value) => String(value || '').toLowerCase().includes(keyword));
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesType = typeFilter === 'all' || item.newsType === typeFilter;
      return matchesKeyword && matchesStatus && matchesType;
    });
  }, [news, search, statusFilter, typeFilter]);

  const stats = useMemo(() => ({
    total: news.length,
    published: news.filter((item) => item.status === 'published').length,
    internal: news.filter((item) => item.newsType !== 'external').length,
    external: news.filter((item) => item.newsType === 'external').length
  }), [news]);

  const openModal = (item = null) => {
    setEditingNews(item);
    setFormData(item ? {
      ...emptyForm,
      ...item,
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : ''
    } : emptyForm);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingNews(null);
    setFormData(emptyForm);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'newsType' && value === 'internal') {
        next.sourceName = '';
        next.sourceUrl = '';
        next.originalAuthor = '';
      }
      return next;
    });
  };

  const validateForm = () => {
    if (!formData.title.trim()) return 'Vui lòng nhập tiêu đề tin tức.';
    if (!formData.content.trim()) return 'Vui lòng nhập nội dung tin tức.';
    if (formData.newsType === 'external') {
      if (!formData.sourceName.trim()) return 'Vui lòng nhập tên nguồn.';
      if (!formData.sourceUrl.trim()) return 'Vui lòng nhập link nguồn.';
      if (!isValidUrl(formData.sourceUrl.trim())) return 'Link nguồn phải đúng định dạng URL.';
    }
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationMessage = validateForm();
    if (validationMessage) {
      Swal.fire('Thiếu thông tin', validationMessage, 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        sourceName: formData.newsType === 'external' ? formData.sourceName : '',
        sourceUrl: formData.newsType === 'external' ? formData.sourceUrl : '',
        originalAuthor: formData.newsType === 'external' ? formData.originalAuthor : ''
      };

      const request = editingNews
        ? axiosClient.put(`/news/admin/${editingNews._id}`, payload)
        : axiosClient.post('/news/admin', payload);
      const { data } = await request;

      Swal.fire('Thành công', data.message || 'Đã lưu tin tức.', 'success');
      closeModal();
      loadNews();
    } catch (err) {
      Swal.fire('Lỗi', err.response?.data?.message || 'Không thể lưu tin tức.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: 'Xóa tin tức?',
      html: `<p>Bạn có chắc muốn xóa <b>${item.title}</b>?</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa tin',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#dc3545'
    });

    if (!result.isConfirmed) return;

    try {
      const { data } = await axiosClient.delete(`/news/admin/${item._id}`);
      Swal.fire('Đã xóa', data.message || 'Tin tức đã được xóa.', 'success');
      loadNews();
    } catch (err) {
      Swal.fire('Lỗi', err.response?.data?.message || 'Không thể xóa tin tức.', 'error');
    }
  };

  return (
    <div className="news-manager-page">
      <div className="admin-page-heading">
        <div>
          <span>ARENAHUB ADMIN</span>
          <h1>Quản lý tin tức</h1>
          <p>Tạo tin nội bộ hoặc tin tóm tắt từ nguồn ngoài, quản lý trạng thái hiển thị cho người dùng.</p>
        </div>
        <Button className="news-admin-primary-btn" onClick={() => openModal()}>
          <Plus size={18} />
          Thêm tin tức
        </Button>
      </div>

      <Row className="g-3 news-admin-stats">
        <Col sm={6} xl={3}>
          <Card><Newspaper size={22} /><span>Tổng tin</span><strong>{stats.total}</strong></Card>
        </Col>
        <Col sm={6} xl={3}>
          <Card><FileText size={22} /><span>Đã xuất bản</span><strong>{stats.published}</strong></Card>
        </Col>
        <Col sm={6} xl={3}>
          <Card><Newspaper size={22} /><span>Tin nội bộ</span><strong>{stats.internal}</strong></Card>
        </Col>
        <Col sm={6} xl={3}>
          <Card><ExternalLink size={22} /><span>Nguồn ngoài</span><strong>{stats.external}</strong></Card>
        </Col>
      </Row>

      <Card className="news-admin-toolbar">
        <Row className="g-3">
          <Col lg={6}>
            <InputGroup>
              <InputGroup.Text><Search size={18} /></InputGroup.Text>
              <Form.Control
                placeholder="Tìm theo tiêu đề, tóm tắt, danh mục, nguồn..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </InputGroup>
          </Col>
          <Col sm={6} lg={3}>
            <Form.Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="draft">Bản nháp</option>
              <option value="published">Đã xuất bản</option>
              <option value="hidden">Đã ẩn</option>
            </Form.Select>
          </Col>
          <Col sm={6} lg={3}>
            <Form.Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">Tất cả loại tin</option>
              <option value="internal">Tin nội bộ</option>
              <option value="external">Tin nguồn ngoài</option>
            </Form.Select>
          </Col>
        </Row>
      </Card>

      <Card className="news-admin-list">
        {loading ? (
          <div className="news-admin-state">
            <Spinner animation="border" variant="success" />
            <span>Đang tải danh sách tin tức...</span>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="news-admin-state">
            <Inbox size={42} />
            <h5>Chưa có tin tức phù hợp</h5>
          </div>
        ) : (
          <Table responsive hover className="align-middle mb-0 news-admin-table">
            <thead>
              <tr>
                <th>Tin tức</th>
                <th>Loại tin</th>
                <th>Danh mục</th>
                <th>Trạng thái</th>
                <th>Ngày đăng</th>
                <th className="text-end">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredNews.map((item) => (
                <tr key={item._id}>
                  <td>
                    <div className="news-admin-title-cell">
                      {item.thumbnail ? <img src={item.thumbnail} alt={item.title} /> : <span className="news-admin-thumb-placeholder"><Newspaper size={18} /></span>}
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.summary || 'Không có tóm tắt'}</span>
                        {item.newsType === 'external' && item.sourceName && <small>Nguồn: {item.sourceName}</small>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge bg={item.newsType === 'external' ? 'info' : 'success'}>
                      {newsTypeLabels[item.newsType] || 'Tin nội bộ'}
                    </Badge>
                  </td>
                  <td>{item.category}</td>
                  <td>
                    <Badge bg={item.status === 'published' ? 'success' : item.status === 'hidden' ? 'secondary' : 'warning'} text={item.status === 'draft' ? 'dark' : undefined}>
                      {statusLabels[item.status] || item.status}
                    </Badge>
                  </td>
                  <td>{formatDate(item.publishedAt || item.createdAt)}</td>
                  <td className="text-end">
                    <div className="news-admin-actions">
                      <Button variant="light" size="sm" title="Sửa" onClick={() => openModal(item)}>
                        <Edit3 size={17} />
                      </Button>
                      <Button variant="light" size="sm" className="text-danger" title="Xóa" onClick={() => handleDelete(item)}>
                        <Trash2 size={17} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal show={showModal} onHide={closeModal} centered size="xl" dialogClassName="news-admin-modal">
        <Modal.Header closeButton>
          <Modal.Title>{editingNews ? 'Cập nhật tin tức' : 'Thêm tin tức mới'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row className="g-3">
              <Col lg={8}>
                <Form.Label>Tiêu đề</Form.Label>
                <Form.Control required value={formData.title} onChange={(event) => handleChange('title', event.target.value)} />
              </Col>
              <Col lg={4}>
                <Form.Label>Danh mục</Form.Label>
                <Form.Select value={formData.category} onChange={(event) => handleChange('category', event.target.value)}>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </Form.Select>
              </Col>
              <Col xs={12}>
                <Form.Label>Thumbnail URL</Form.Label>
                <Form.Control value={formData.thumbnail} onChange={(event) => handleChange('thumbnail', event.target.value)} />
              </Col>
              <Col xs={12}>
                <Form.Label>Loại tin</Form.Label>
                <div className="news-type-options">
                  <Form.Check
                    inline
                    type="radio"
                    id="news-type-internal"
                    label="Tin nội bộ"
                    checked={formData.newsType === 'internal'}
                    onChange={() => handleChange('newsType', 'internal')}
                  />
                  <Form.Check
                    inline
                    type="radio"
                    id="news-type-external"
                    label="Tin nguồn ngoài"
                    checked={formData.newsType === 'external'}
                    onChange={() => handleChange('newsType', 'external')}
                  />
                </div>
              </Col>

              {formData.newsType === 'external' && (
                <>
                  <Col md={4}>
                    <Form.Label>Tên nguồn</Form.Label>
                    <Form.Control required value={formData.sourceName} onChange={(event) => handleChange('sourceName', event.target.value)} />
                  </Col>
                  <Col md={5}>
                    <Form.Label>Link nguồn</Form.Label>
                    <Form.Control required type="url" value={formData.sourceUrl} onChange={(event) => handleChange('sourceUrl', event.target.value)} />
                  </Col>
                  <Col md={3}>
                    <Form.Label>Tác giả gốc</Form.Label>
                    <Form.Control value={formData.originalAuthor} onChange={(event) => handleChange('originalAuthor', event.target.value)} />
                  </Col>
                  <Col xs={12}>
                    <div className="news-source-note">
                      Chỉ nhập nội dung tóm tắt/ngắn gọn từ nguồn ngoài, không copy nguyên văn toàn bộ bài viết.
                    </div>
                  </Col>
                </>
              )}

              <Col xs={12}>
                <Form.Label>Tóm tắt</Form.Label>
                <Form.Control as="textarea" rows={3} value={formData.summary} onChange={(event) => handleChange('summary', event.target.value)} />
              </Col>
              <Col xs={12}>
                <Form.Label>Nội dung</Form.Label>
                <Form.Control required as="textarea" rows={9} value={formData.content} onChange={(event) => handleChange('content', event.target.value)} />
              </Col>
              <Col md={4}>
                <Form.Label>Tags</Form.Label>
                <Form.Control placeholder="VD: khuyến mãi, sân bóng" value={formData.tags} onChange={(event) => handleChange('tags', event.target.value)} />
              </Col>
              <Col md={4}>
                <Form.Label>Trạng thái</Form.Label>
                <Form.Select value={formData.status} onChange={(event) => handleChange('status', event.target.value)}>
                  <option value="draft">Bản nháp</option>
                  <option value="published">Đã xuất bản</option>
                  <option value="hidden">Đã ẩn</option>
                </Form.Select>
              </Col>
              <Col md={4} className="d-flex align-items-end">
                <Form.Check
                  type="switch"
                  id="news-featured-switch"
                  label="Tin nổi bật"
                  checked={formData.isFeatured}
                  onChange={(event) => handleChange('isFeatured', event.target.checked)}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={closeModal}>Hủy</Button>
            <Button type="submit" className="news-admin-primary-btn" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : <FileText size={17} />}
              Lưu tin tức
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default NewsManager;
