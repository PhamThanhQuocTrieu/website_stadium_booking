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
  CalendarDays,
  CheckCircle2,
  CloudUpload,
  Edit3,
  Image,
  Inbox,
  Megaphone,
  Plus,
  Search,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
  Trash2,
  XCircle
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Swal from 'sweetalert2';
import axiosClient from '../../api/axiosClient';
import socket from '../../socket';
import '../../styles/admin/admin-common.css';
import '../../styles/admin/bannermanager.css';

const emptyForm = {
  title: '',
  subtitle: '',
  description: '',
  image: '',
  buttonText: '',
  buttonLink: '',
  voucherCode: '',
  position: 'home_hero',
  order: 0,
  isActive: true,
  startDate: '',
  endDate: ''
};

const ITEMS_PER_PAGE = 6;

const positionLabels = {
  home_hero: 'Hero trang chủ',
  home_promo: 'Khuyến mãi trang chủ'
};

const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return 'Không giới hạn';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Không giới hạn';
  return date.toLocaleDateString('vi-VN');
};

const isBannerInDateRange = (banner) => {
  const now = new Date();
  const start = banner.startDate ? new Date(banner.startDate) : null;
  const end = banner.endDate ? new Date(banner.endDate) : null;
  return (!start || start <= now) && (!end || end >= now);
};

const BannerManager = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const loadBanners = async () => {
    try {
      setLoading(true);
      const { data } = await axiosClient.get('/admin/banners');
      setBanners(Array.isArray(data) ? data : data.banners || []);
    } catch (err) {
      Swal.fire('Lỗi', err.response?.data?.message || 'Không thể tải danh sách banner.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanners();
    if (!socket.connected) socket.connect();
    socket.on('banner_updated', loadBanners);
    return () => {
      socket.off('banner_updated', loadBanners);
    };
  }, []);

  const filteredBanners = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return banners.filter((banner) => {
      const matchesKeyword = !keyword || [banner.title, banner.subtitle, banner.voucherCode]
        .some((value) => String(value || '').toLowerCase().includes(keyword));
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' ? banner.isActive : !banner.isActive);
      const matchesPosition = positionFilter === 'all' || banner.position === positionFilter;
      return matchesKeyword && matchesStatus && matchesPosition;
    });
  }, [banners, search, statusFilter, positionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBanners.length / ITEMS_PER_PAGE));
  const paginatedBanners = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBanners.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBanners, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, positionFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const stats = useMemo(() => ({
    total: banners.length,
    active: banners.filter((banner) => banner.isActive).length,
    hidden: banners.filter((banner) => !banner.isActive).length,
    valid: banners.filter((banner) => banner.isActive && isBannerInDateRange(banner)).length
  }), [banners]);

  const openUploadWidget = () => {
    if (!window.cloudinary) {
      Swal.fire('Lỗi', 'Thư viện upload Cloudinary chưa tải xong.', 'error');
      return;
    }

    window.cloudinary.openUploadWidget({
      cloudName: 'dp8zttoxz',
      uploadPreset: 'arenahub_preset',
      sources: ['local', 'url', 'camera'],
      multiple: false,
      cropping: false,
      folder: 'arenahub/banners'
    }, (error, result) => {
      if (!error && result?.event === 'success') {
        setFormData((prev) => ({ ...prev, image: result.info.secure_url }));
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Tải ảnh banner thành công',
          showConfirmButton: false,
          timer: 1600
        });
      }
    });
  };

  const openModal = (banner = null) => {
    setEditingBanner(banner);
    setFormData(banner ? {
      ...emptyForm,
      ...banner,
      startDate: toDateInput(banner.startDate),
      endDate: toDateInput(banner.endDate)
    } : emptyForm);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBanner(null);
    setFormData(emptyForm);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    const payload = {
      ...formData,
      order: Number(formData.order || 0),
      startDate: formData.startDate || null,
      endDate: formData.endDate || null
    };

    try {
      const request = editingBanner
        ? axiosClient.put(`/admin/banners/${editingBanner._id}`, payload)
        : axiosClient.post('/admin/banners', payload);
      const { data } = await request;

      Swal.fire('Thành công', data.message || 'Đã lưu banner.', 'success');
      closeModal();
      loadBanners();
    } catch (err) {
      Swal.fire('Lỗi', err.response?.data?.message || 'Không thể lưu banner.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (banner) => {
    const result = await Swal.fire({
      title: 'Xóa banner?',
      html: `<p>Bạn có chắc muốn xóa <b>${banner.title}</b>?</p>`,
      imageUrl: banner.image,
      imageWidth: 280,
      imageHeight: 110,
      imageAlt: banner.title,
      showCancelButton: true,
      confirmButtonText: 'Xóa banner',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#dc3545'
    });

    if (!result.isConfirmed) return;

    try {
      const { data } = await axiosClient.delete(`/admin/banners/${banner._id}`);
      Swal.fire('Đã xóa', data.message || 'Banner đã được xóa.', 'success');
      loadBanners();
    } catch (err) {
      Swal.fire('Lỗi', err.response?.data?.message || 'Không thể xóa banner.', 'error');
    }
  };

  const handleToggle = async (banner) => {
    try {
      const { data } = await axiosClient.patch(`/admin/banners/${banner._id}/toggle-active`);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: data.message || 'Đã đổi trạng thái banner.',
        showConfirmButton: false,
        timer: 1600
      });
      loadBanners();
    } catch (err) {
      Swal.fire('Lỗi', err.response?.data?.message || 'Không thể đổi trạng thái banner.', 'error');
    }
  };

  return (
    <motion.div
      className="banner-manager-page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="admin-page-heading">
        <div>
          <span>ARENAHUB ADMIN</span>
          <h1>Quản lý banner</h1>
          <p>Điều phối hình ảnh quảng bá, ưu đãi và CTA hiển thị trên trang chủ.</p>
        </div>
        <Button className="banner-primary-btn" onClick={() => openModal()}>
          <Plus size={18} />
          Thêm banner
        </Button>
      </div>

      <Row className="g-3 banner-stats-row">
        <Col sm={6} xl={3}>
          <Card className="banner-stat-card">
            <Image size={22} />
            <span>Tổng banner</span>
            <strong>{stats.total}</strong>
          </Card>
        </Col>
        <Col sm={6} xl={3}>
          <Card className="banner-stat-card success">
            <CheckCircle2 size={22} />
            <span>Đang bật</span>
            <strong>{stats.active}</strong>
          </Card>
        </Col>
        <Col sm={6} xl={3}>
          <Card className="banner-stat-card muted">
            <XCircle size={22} />
            <span>Đã ẩn</span>
            <strong>{stats.hidden}</strong>
          </Card>
        </Col>
        <Col sm={6} xl={3}>
          <Card className="banner-stat-card info">
            <CalendarDays size={22} />
            <span>Còn hiệu lực</span>
            <strong>{stats.valid}</strong>
          </Card>
        </Col>
      </Row>

      <Card className="banner-toolbar-card">
        <Row className="g-3 align-items-center">
          <Col lg={6}>
            <InputGroup className="banner-search-box">
              <InputGroup.Text><Search size={18} /></InputGroup.Text>
              <Form.Control
                placeholder="Tìm theo tiêu đề, tiêu đề phụ hoặc mã voucher..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </InputGroup>
          </Col>
          <Col sm={6} lg={3}>
            <Form.Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hiển thị</option>
              <option value="inactive">Đã ẩn</option>
            </Form.Select>
          </Col>
          <Col sm={6} lg={3}>
            <Form.Select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
              <option value="all">Tất cả vị trí</option>
              <option value="home_hero">Hero trang chủ</option>
              <option value="home_promo">Khuyến mãi trang chủ</option>
            </Form.Select>
          </Col>
        </Row>
      </Card>

      <Card className="banner-list-card">
        {loading ? (
          <div className="banner-loading-state">
            <Spinner animation="border" variant="success" />
            <span>Đang tải danh sách banner...</span>
          </div>
        ) : filteredBanners.length === 0 ? (
          <div className="banner-empty-state">
            <Inbox size={42} />
            <h5>Chưa có banner phù hợp</h5>
            <p>Thử đổi bộ lọc hoặc tạo banner mới cho trang chủ.</p>
          </div>
        ) : (
          <>
            <div className="banner-table-wrap">
              <Table responsive hover className="banner-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Banner</th>
                    <th>Vị trí</th>
                    <th>Mã voucher</th>
                    <th>Thứ tự</th>
                    <th>Hiệu lực</th>
                    <th>Trạng thái</th>
                    <th className="text-end">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {paginatedBanners.map((banner) => (
                      <motion.tr key={banner._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <td>
                          <div className="banner-table-main">
                            <img src={banner.image} alt={banner.title} />
                            <div>
                              <strong>{banner.title}</strong>
                              <span>{banner.subtitle || banner.description || 'Không có mô tả phụ'}</span>
                            </div>
                          </div>
                        </td>
                        <td><Badge bg="light" text="dark">{positionLabels[banner.position]}</Badge></td>
                        <td>{banner.voucherCode ? <Badge bg="warning" text="dark">{banner.voucherCode}</Badge> : <span className="text-muted">-</span>}</td>
                        <td>{banner.order}</td>
                        <td>
                          <div className="banner-date-range">
                            <span>{formatDate(banner.startDate)}</span>
                            <small>đến {formatDate(banner.endDate)}</small>
                          </div>
                        </td>
                        <td>
                          <Badge bg={banner.isActive ? 'success' : 'secondary'}>
                            {banner.isActive ? 'Đang hiển thị' : 'Đã ẩn'}
                          </Badge>
                        </td>
                        <td className="text-end">
                          <div className="banner-action-group">
                            <Button
                              variant="light"
                              size="sm"
                              className={`banner-toggle-btn ${banner.isActive ? 'active' : 'inactive'}`}
                              title="Bật/tắt"
                              onClick={() => handleToggle(banner)}
                            >
                              {banner.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                            </Button>
                            <Button variant="light" size="sm" title="Sửa" onClick={() => openModal(banner)}>
                              <Edit3 size={17} />
                            </Button>
                            <Button variant="light" size="sm" className="text-danger" title="Xóa" onClick={() => handleDelete(banner)}>
                              <Trash2 size={17} />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </Table>
            </div>

            <div className="banner-mobile-list">
              <AnimatePresence>
                {paginatedBanners.map((banner) => (
                  <motion.article
                    key={banner._id}
                    className="banner-mobile-card"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <img src={banner.image} alt={banner.title} />
                    <div className="banner-mobile-card-body">
                      <div className="d-flex justify-content-between gap-2">
                        <h5>{banner.title}</h5>
                        <Badge bg={banner.isActive ? 'success' : 'secondary'}>{banner.isActive ? 'Bật' : 'Ẩn'}</Badge>
                      </div>
                      <p>{banner.subtitle || banner.description || 'Không có mô tả phụ'}</p>
                      <div className="banner-mobile-meta">
                        <span><SlidersHorizontal size={15} /> {positionLabels[banner.position]}</span>
                        <span>#{banner.order}</span>
                        {banner.voucherCode && <span>{banner.voucherCode}</span>}
                      </div>
                      <div className="banner-action-group">
                        <Button
                          variant="light"
                          size="sm"
                          className={`banner-toggle-btn ${banner.isActive ? 'active' : 'inactive'}`}
                          onClick={() => handleToggle(banner)}
                        >
                          {banner.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </Button>
                        <Button variant="light" size="sm" onClick={() => openModal(banner)}><Edit3 size={17} /></Button>
                        <Button variant="light" size="sm" className="text-danger" onClick={() => handleDelete(banner)}><Trash2 size={17} /></Button>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
            </div>

            {filteredBanners.length > ITEMS_PER_PAGE && (
              <div className="admin-pagination-shell">
                <span>Hiển thị {paginatedBanners.length} / {filteredBanners.length} banner</span>
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
          </>
        )}
      </Card>

      <Modal show={showModal} onHide={closeModal} centered size="lg" dialogClassName="banner-modal">
        <Modal.Header closeButton>
          <Modal.Title>{editingBanner ? 'Cập nhật banner' : 'Thêm banner mới'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row className="g-3">
              <Col lg={5}>
                <div className="banner-upload-box" onClick={openUploadWidget}>
                  {formData.image ? (
                    <img src={formData.image} alt="Preview banner" />
                  ) : (
                    <div>
                      <CloudUpload size={42} />
                      <strong>Chọn ảnh banner</strong>
                      <span>Ảnh ngang 16:6 hoặc 16:9 sẽ đẹp nhất</span>
                    </div>
                  )}
                </div>
              </Col>
              <Col lg={7}>
                <Row className="g-3">
                  <Col xs={12}>
                    <Form.Label>Tiêu đề</Form.Label>
                    <Form.Control required value={formData.title} onChange={(event) => handleChange('title', event.target.value)} />
                  </Col>
                  <Col xs={12}>
                    <Form.Label>Tiêu đề phụ</Form.Label>
                    <Form.Control value={formData.subtitle} onChange={(event) => handleChange('subtitle', event.target.value)} />
                  </Col>
                  <Col xs={12}>
                    <Form.Label>Mô tả ngắn</Form.Label>
                    <Form.Control as="textarea" rows={3} value={formData.description} onChange={(event) => handleChange('description', event.target.value)} />
                  </Col>
                </Row>
              </Col>
              <Col md={4}>
                <Form.Label>Mã voucher</Form.Label>
                <Form.Control value={formData.voucherCode} onChange={(event) => handleChange('voucherCode', event.target.value.toUpperCase())} />
              </Col>
              <Col md={4}>
                <Form.Label>Vị trí hiển thị</Form.Label>
                <Form.Select value={formData.position} onChange={(event) => handleChange('position', event.target.value)}>
                  <option value="home_hero">Hero trang chủ</option>
                  <option value="home_promo">Khuyến mãi trang chủ</option>
                </Form.Select>
              </Col>
              <Col md={4}>
                <Form.Label>Thứ tự hiển thị</Form.Label>
                <Form.Control type="number" value={formData.order} onChange={(event) => handleChange('order', event.target.value)} />
              </Col>
              <Col md={6}>
                <Form.Label>Ngày bắt đầu</Form.Label>
                <Form.Control type="date" value={formData.startDate} onChange={(event) => handleChange('startDate', event.target.value)} />
              </Col>
              <Col md={6}>
                <Form.Label>Ngày kết thúc</Form.Label>
                <Form.Control type="date" value={formData.endDate} onChange={(event) => handleChange('endDate', event.target.value)} />
              </Col>
              <Col xs={12}>
                <Form.Check
                  type="switch"
                  id="banner-active-switch"
                  label="Bật hiển thị banner"
                  checked={formData.isActive}
                  onChange={(event) => handleChange('isActive', event.target.checked)}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={closeModal}>Hủy</Button>
            <Button type="submit" className="banner-primary-btn" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : <Megaphone size={17} />}
              Lưu banner
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </motion.div>
  );
};

export default BannerManager;
