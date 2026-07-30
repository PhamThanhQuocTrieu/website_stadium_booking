import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Modal,
  Pagination,
  Row,
  Spinner,
  Table
} from 'react-bootstrap';
import {
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Edit3,
  FileText,
  Image as ImageIcon,
  Inbox,
  Newspaper,
  Plus,
  Search,
  Trash2
} from 'lucide-react';
import Swal from 'sweetalert2';
import axiosClient from '../../api/axiosClient';
import RichTextEditor from '../../components/RichTextEditor';
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

const pageSizeOptions = [5, 10, 20, 50];

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadNews = async () => {
    try {
      setLoading(true);
      const { data } = await axiosClient.get('/news/admin/all');
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
  }, []);

  const filteredNews = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return news.filter((item) => {
      const matchesKeyword = !keyword || [item.title, item.summary, item.category]
        .some((value) => String(value || '').toLowerCase().includes(keyword));
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [news, search, statusFilter]);

  const stats = useMemo(() => ({
    total: news.length,
    published: news.filter((item) => item.status === 'published').length,
    internal: news.length
  }), [news]);

  const openUploadWidget = () => {
    if (!window.cloudinary) {
      Swal.fire('Lỗi', 'Thư viện upload Cloudinary chưa tải xong.', 'error');
      return;
    }

    window.cloudinary.openUploadWidget({
      cloudName: 'dp8zttoxz',
      uploadPreset: 'arenahub_preset',
      sources: ['local', 'camera'],
      multiple: false,
      cropping: false,
      folder: 'arenahub/news'
    }, (error, result) => {
      if (!error && result?.event === 'success') {
        setFormData((prev) => ({ ...prev, thumbnail: result.info.secure_url }));
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Tải ảnh thumbnail thành công',
          showConfirmButton: false,
          timer: 1600
        });
      }
    });
  };

  const totalPages = Math.max(1, Math.ceil(filteredNews.length / pageSize));

  const paginatedNews = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredNews.slice(startIndex, startIndex + pageSize);
  }, [filteredNews, currentPage, pageSize]);

  const paginationItems = useMemo(() => {
    const maxVisiblePages = 5;
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(currentPage - half, 1);
    const end = Math.min(start + maxVisiblePages - 1, totalPages);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(end - maxVisiblePages + 1, 1);
    }

    const pages = [];

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) return 'Vui lòng nhập tiêu đề tin tức.';
    if (!formData.content.trim()) return 'Vui lòng nhập nội dung tin tức.';
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
        newsType: 'internal'
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
          <p>Tạo và quản lý tin nội bộ, trạng thái hiển thị cho người dùng.</p>
        </div>
        <Button className="news-admin-primary-btn" onClick={() => openModal()}>
          <Plus size={18} />
          Thêm tin tức
        </Button>
      </div>

      <Row className="g-3 news-admin-stats">
        <Col sm={6} xl={4}>
          <Card><Newspaper size={22} /><span>Tổng tin</span><strong>{stats.total}</strong></Card>
        </Col>
        <Col sm={6} xl={4}>
          <Card><FileText size={22} /><span>Đã xuất bản</span><strong>{stats.published}</strong></Card>
        </Col>
        <Col sm={6} xl={4}>
          <Card><Newspaper size={22} /><span>Tin nội bộ</span><strong>{stats.internal}</strong></Card>
        </Col>
      </Row>

      <Card className="news-admin-toolbar">
        <Row className="g-3">
          <Col lg={6}>
            <InputGroup>
              <InputGroup.Text><Search size={18} /></InputGroup.Text>
              <Form.Control
                placeholder="Tìm theo tiêu đề, tóm tắt, danh mục..."
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
            <Form.Select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              aria-label="Số tin mỗi trang"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size} tin</option>
              ))}
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
                <th>Danh mục</th>
                <th>Trạng thái</th>
                <th>Ngày đăng</th>
                <th className="text-end">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedNews.map((item) => (
                <tr key={item._id}>
                  <td>
                    <div className="news-admin-title-cell">
                      {item.thumbnail ? <img src={item.thumbnail} alt={item.title} /> : <span className="news-admin-thumb-placeholder"><Newspaper size={18} /></span>}
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.summary || 'Không có tóm tắt'}</span>
                      </div>
                    </div>
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
        {!loading && filteredNews.length > 0 && (
          <Card.Footer className="news-admin-pagination-footer">
            <div className="news-admin-page-summary">
              Hiển thị {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredNews.length)} trong {filteredNews.length} tin
            </div>
            <Pagination className="news-admin-pagination mb-0">
              <Pagination.Prev disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
                <ChevronLeft size={16} />
              </Pagination.Prev>
              {paginationItems[0] > 1 && (
                <>
                  <Pagination.Item onClick={() => setCurrentPage(1)}>1</Pagination.Item>
                  {paginationItems[0] > 2 && <Pagination.Ellipsis disabled />}
                </>
              )}
              {paginationItems.map((page) => (
                <Pagination.Item
                  key={page}
                  active={page === currentPage}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Pagination.Item>
              ))}
              {paginationItems[paginationItems.length - 1] < totalPages && (
                <>
                  {paginationItems[paginationItems.length - 1] < totalPages - 1 && <Pagination.Ellipsis disabled />}
                  <Pagination.Item onClick={() => setCurrentPage(totalPages)}>{totalPages}</Pagination.Item>
                </>
              )}
              <Pagination.Next disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
                <ChevronRight size={16} />
              </Pagination.Next>
            </Pagination>
          </Card.Footer>
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
                <Form.Label>Ảnh thumbnail</Form.Label>
                <div className="news-thumbnail-upload">
                  <button type="button" className="news-thumbnail-dropzone" onClick={openUploadWidget}>
                    {formData.thumbnail ? (
                      <img src={formData.thumbnail} alt="Preview thumbnail" />
                    ) : (
                      <span>
                        <CloudUpload size={40} />
                        <strong>Chọn ảnh thumbnail</strong>
                        <small>Upload ảnh từ máy để hiển thị trên danh sách và chi tiết tin tức</small>
                      </span>
                    )}
                  </button>
                  <div className="news-thumbnail-actions">
                    <Button type="button" variant="light" onClick={openUploadWidget}>
                      <ImageIcon size={17} />
                      {formData.thumbnail ? 'Đổi ảnh' : 'Upload ảnh'}
                    </Button>
                    {formData.thumbnail && (
                      <Button type="button" variant="outline-danger" onClick={() => handleChange('thumbnail', '')}>
                        <Trash2 size={17} />
                        Bỏ ảnh
                      </Button>
                    )}
                  </div>
                </div>
              </Col>
              <Col xs={12}>
                <Form.Label>Tóm tắt</Form.Label>
                <Form.Control as="textarea" rows={3} value={formData.summary} onChange={(event) => handleChange('summary', event.target.value)} />
              </Col>
              <Col xs={12}>
                <Form.Label>Nội dung</Form.Label>
                <RichTextEditor
                  value={formData.content}
                  onChange={(html) => handleChange('content', html)}
                  placeholder="Nhập nội dung..."
                  height={300}
                />
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
