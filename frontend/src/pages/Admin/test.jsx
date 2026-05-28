// File: Frontend/src/pages/Admin/FieldManager.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Modal, Form, Badge, Card, Row, Col, Spinner, InputGroup, Tabs, Tab } from 'react-bootstrap';
import { Plus, Edit, Trash2, CloudUpload, Star, Trash, DollarSign, Clock, MapPin, Search, Filter, SlidersHorizontal, Layers, CalendarDays } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { io } from 'socket.io-client';

// Import file CSS độc lập gọn gàng
import '../../styles/admin/fieldmanager.css';

const socket = io('http://localhost:5000');



const FieldManager = () => {
  const [fields, setFields] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // States kiểm soát bộ lọc tìm kiếm nâng cao
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('Tất cả');
  const [statusFilter, setStatusFilter] = useState('Tất cả');

  // --- THÔNG TIN CLOUDINARY ---
  const CLOUD_NAME = "dp8zttoxz";
  const UPLOAD_PRESET = "arenahub_preset";

  const initialForm = {
    fieldName: '',
    type: 'Bóng đá',
    address: '',
    image: '',
    description: '',
    gallery: [],
    isFeatured: false,
    status: 'Active',
    services: [
      { name: 'Wifi miễn phí', isAvailable: false },
      { name: 'Bãi đậu xe', isAvailable: false },
      { name: 'Canteen', isAvailable: false },
      { name: 'Nước uống', isAvailable: false }
    ],
    // 🌟 Cấu hình mặc định 3 khung giờ theo yêu cầu
    pricingRules: [
      {
        ruleName: 'Khung giờ sáng T2-T6',
        dayType: 'Weekday',
        startTime: '05:00',
        endTime: '17:00',
        price: 200000,
        isPeakHour: false
      },
      {
        ruleName: 'Khung giờ vàng T2-T6',
        dayType: 'Weekday',
        startTime: '17:00',
        endTime: '23:00',
        price: 250000,
        isPeakHour: true
      },
      {
        ruleName: 'Cuối Tuần',
        dayType: 'Weekend',
        startTime: '05:00',
        endTime: '23:00',
        price: 270000,
        isPeakHour: true
      }
    ]
  };

  const [formData, setFormData] = useState(initialForm);

// Đảm bảo bạn gọi API với header đầy đủ
const fetchFields = async () => {
    const token = localStorage.getItem('userToken'); // Lấy từ localStorage
    try {
        const res = await axiosClient.get('http://localhost:5000/api/fields', { // Đảm bảo đúng route
            headers: { Authorization: `Bearer ${token}` }
        });
        setFields(res.data);
    } catch (err) {
        console.error("Lỗi:", err);
    }
};

  useEffect(() => {
    fetchFields();
    socket.on('field_updated', (data) => {
      fetchFields();
    });
    return () => { socket.off('field_updated'); };
  }, []);

  // Logic lọc đa năng xử lý tìm kiếm và phân loại 3 trạng thái
  const filteredFields = useMemo(() => {
    return fields.filter(f => {
      const matchesSearch = f.fieldName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.address.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'Tất cả' || f.type === typeFilter;
      const matchesStatus = statusFilter === 'Tất cả' || f.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [fields, searchTerm, typeFilter, statusFilter]);

  const handleFileUpload = async (e, isGallery = false) => {
    const file = e.target.files[0];
    if (!file) return;

    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', UPLOAD_PRESET);

    try {
      setUploading(true);
      const res = await axiosClient.post(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, data);
      const url = res.data.secure_url;

      if (isGallery) {
        setFormData(prev => ({ ...prev, gallery: [...prev.gallery, url] }));
      } else {
        setFormData(prev => ({ ...prev, image: url }));
      }
      setUploading(false);
      Swal.fire({ icon: 'success', title: 'Đã tải ảnh lên!', timer: 1000, showConfirmButton: false });
    } catch (err) {
      setUploading(false);
      Swal.fire('Lỗi', 'Không thể upload ảnh.', 'error');
    }
  };

  const handleAddPricingRule = () => {
    const newRule = { ruleName: '', dayType: 'Weekday', startTime: '05:00', endTime: '22:00', price: 150000, isPeakHour: false };
    setFormData(prev => ({ ...prev, pricingRules: [...prev.pricingRules, newRule] }));
  };

  const handleRemovePricingRule = (index) => {
    setFormData(prev => ({ ...prev, pricingRules: prev.pricingRules.filter((_, i) => i !== index) }));
  };

  const handlePricingRuleChange = (index, field, value) => {
    const updatedRules = [...formData.pricingRules];
    updatedRules[index][field] = value;
    setFormData({ ...formData, pricingRules: updatedRules });
  };

  // 🌟 HÀM SUBMIT KHẮC PHỤC TỐI CAO: Mã hóa mảng thành JSON String chặn đứng lỗi băm dữ liệu rác
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.fieldName || !formData.fieldName.trim()) {
      Swal.fire('Chú ý', 'vui lòng điền Tên sân tập ở tab THÔNG TIN CHUNG nhé!', 'warning');
      setLoading(false);
      return;
    }

    if (!formData.address || !formData.address.trim()) {
      Swal.fire('Chú ý', 'vui lòng điền Địa chỉ bãi ở tab THÔNG TIN CHUNG nhé!', 'warning');
      setLoading(false);
      return;
    }

    if (formData.pricingRules.some(r => !r.ruleName || !r.ruleName.trim() || !r.price)) {
      Swal.fire('Chú ý', 'vui lòng nhập đầy đủ tên khung giờ và đơn giá áp dụng nhé!', 'warning');
      setLoading(false);
      return;
    }

    const sanitizedPricingRules = formData.pricingRules.map(rule => {
      const cleanRule = {
        ruleName: rule.ruleName.trim(),
        dayType: rule.dayType || 'Weekday',
        startTime: rule.startTime || '05:00',
        endTime: rule.endTime || '22:00',
        price: Number(rule.price) || 0,
        isPeakHour: Boolean(rule.isPeakHour)
      };

      const isValidObjectId = rule._id && /^[0-9a-fA-F]{24}$/.test(String(rule._id));
      if (isValidObjectId) {
        cleanRule._id = rule._id;
      }

      return cleanRule;
    });

    const dataToSend = {
      fieldName: formData.fieldName.trim(),
      type: formData.type,
      address: formData.address.trim(),
      image: formData.image || '',
      description: formData.description || '',
      gallery: formData.gallery || [],
      isFeatured: Boolean(formData.isFeatured),
      status: formData.status,
      services: formData.services,
      pricingRules: JSON.stringify(sanitizedPricingRules) // 🌟 MÃ HÓA STRINGIFY: Sạch sẽ tuyệt đối, không sợ Cast Error
    };

    try {
if (formData._id) {
       // ĐỔI: Dùng axiosClient thay vì axios
       await axiosClient.put(`/admin/fields/${formData._id}`, dataToSend);
     } else {
       // ĐỔI: Dùng axiosClient thay vì axios
       await axiosClient.post('/admin/fields', dataToSend);
     }
      Swal.fire('Thành công', 'Cấu hình bãi bến và bảng giờ linh hoạt đã đồng bộ hệ thống!', 'success');
      setShowModal(false);
      fetchFields();
    } catch (err) {
      console.error("Lỗi chi tiết phản hồi từ Backend:", err.response?.data);
      Swal.fire('Lỗi vận hành', err.response?.data?.message || 'Có lỗi xảy ra khi truyền đồng bộ dữ liệu!', 'error');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Xác nhận xóa?',
      text: "Mọi dữ liệu lịch đặt bãi liên quan và các quy tắc giá sẽ bị xóa sạch!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Xóa vĩnh viễn'
    });
    if (result.isConfirmed) {
      try {
        await axiosClient.delete(`http://localhost:5000/api/admin/fields/${id}`);
        Swal.fire('Đã xóa!', '', 'success');
        fetchFields();
      } catch (err) { Swal.fire('Lỗi', 'Xóa thất bại.', 'error'); }
    }
  };

  const renderStatusLabel = (status) => {
    switch (status) {
      case 'Active':
        return (
          <span className="status-dot-label text-success fw-bold small d-flex align-items-center gap-1">
            <span className="dot-pulse bg-success"></span> Hoạt động
          </span>
        );
      case 'Maintenance':
        return (
          <span className="status-dot-label text-danger fw-bold small d-flex align-items-center gap-1">
            <span className="dot-pulse bg-danger"></span> Bảo trì
          </span>
        );
      case 'Full':
        return (
          <span className="status-dot-label text-warning fw-bold small d-flex align-items-center gap-1">
            <span className="dot-pulse bg-warning"></span> Hết sân
          </span>
        );
      default:
        return status;
    }
  };

  return (
    <div className="p-4 bg-admin-gradient min-vh-100">
      {/* SECTION HEADER */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h3 className="fw-black text-dark mb-1 tracking-tight">Quản lý Tài nguyên Sân</h3>
          <p className="text-muted small mb-0">Thiết lập cấu hình vận hành, dịch vụ và ma trận giá biến động động.</p>
        </div>
        <Button variant="success" className="rounded-3 px-4 py-2 shadow-sm fw-bold d-flex align-items-center gap-2" onClick={() => { setFormData(initialForm); setShowModal(true); }}>
          <Plus size={18} /> Thêm sân bãi mới
        </Button>
      </div>

      {/* THANH CÔNG CỤ TÌM KIẾM VÀ BỘ LỌC NÂNG CAO */}
      <Card className="border-0 shadow-xs rounded-4 p-3 mb-4 bg-white">
        <Row className="g-3">
          <Col md={5} lg={6}>
            <InputGroup className="rounded-3 overflow-hidden border">
              <InputGroup.Text className="bg-white border-0 text-muted border-end-0"><Search size={16} /></InputGroup.Text>
              <Form.Control
                placeholder="Tìm tên sân tập hoặc địa chỉ khu vực..."
                className="border-0 shadow-none py-2 text-dark"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </InputGroup>
          </Col>
          <Col md={3} lg={3}>
            <InputGroup className="rounded-3 overflow-hidden border">
              <InputGroup.Text className="bg-light border-0 text-muted small"><Filter size={14} /></InputGroup.Text>
              <Form.Select className="border-0 shadow-none text-dark py-2" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="Tất cả">Tất cả bộ môn</option>
                <option value="Bóng đá">⚽ Bóng đá</option>
                <option value="Cầu lông">🏸 Cầu lông</option>
                <option value="Pickleball">🏓 Pickleball</option>
                <option value="Tennis">🎾 Tennis</option>
              </Form.Select>
            </InputGroup>
          </Col>
          <Col md={4} lg={3}>
            <InputGroup className="rounded-3 overflow-hidden border">
              <InputGroup.Text className="bg-light border-0 text-muted small"><SlidersHorizontal size={14} /></InputGroup.Text>
              <Form.Select className="border-0 shadow-none text-dark py-2" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="Tất cả">Tất cả trạng thái</option>
                <option value="Active">🟢 Đang hoạt động</option>
                <option value="Maintenance">🔴 Đang bảo trì</option>
                <option value="Full">🟡 Hệ thống hết sân</option>
              </Form.Select>
            </InputGroup>
          </Col>
        </Row>
      </Card>

      {/* BẢNG DANH SÁCH SÂN */}
      <Card className="border-0 shadow-sm rounded-4 overflow-hidden bg-white">
        {filteredFields.length === 0 ? (
          <div className="text-center py-5 text-muted fst-italic">Không tìm thấy tài nguyên sân bãi nào phù hợp bộ lọc.</div>
        ) : (
          <Table hover responsive className="align-middle mb-0 custom-admin-table">
            <thead>
              <tr>
                <th className="ps-4 py-3">TÊN SÂN VÀ ĐỊA CHỈ</th>
                <th>BỘ MÔN</th>
                <th>TRẠNG THÁI</th>
                <th>TRANG CHỦ</th>
                <th className="text-center">THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filteredFields.map(f => (
                <tr key={f._id}>
                  <td className="ps-4">
                    <div className="d-flex align-items-center">
                      <div className="table-img-wrapper shadow-xs me-3 rounded-3 overflow-hidden border">
                        <img src={f.image || 'https://via.placeholder.com/60x60?text=Sân'} width="55" height="55" style={{ objectFit: 'cover' }} alt="field" />
                      </div>
                      <div>
                        <div className="fw-bold text-dark mb-0 fs-6">{f.fieldName}</div>
                        <span className="text-muted text-truncate-custom d-block"><MapPin size={12} className="text-danger me-1" />{f.address}</span>
                      </div>
                    </div>
                  </td>
                  <td><Badge bg="success" className="bg-opacity-10 text-success rounded-pill px-3 py-1 fw-semibold border border-success border-opacity-20">{f.type}</Badge></td>
                  <td>{renderStatusLabel(f.status)}</td>
                  <td>{f.isFeatured ? <Badge bg="warning" className="text-dark fw-bold rounded-pill px-2"><Star size={12} fill="#000" className="me-1" />Nổi bật</Badge> : <span className="text-muted-light small">-</span>}</td>
                  <td className="text-center">
                    <div className="d-flex justify-content-center gap-1">
                      <Button variant="light" className="btn-action-edit rounded-3 text-primary p-2" title="Chỉnh sửa sân" onClick={() => { setFormData(f); setShowModal(true); }}><Edit size={16} /></Button>
                      <Button variant="light" className="btn-action-delete rounded-3 text-danger p-2" title="Xóa sân" onClick={() => handleDelete(f._id)}><Trash2 size={16} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* MODAL CRUD */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" centered scrollable backdrop="static" className="premium-admin-modal">
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton className="border-bottom-0 px-4 pt-4 bg-white">
            <Modal.Title className="fw-black text-dark d-flex align-items-center gap-2">
              <Layers size={22} className="text-success" />
              {formData._id ? 'Cập nhật cấu hình sân' : 'Khởi tạo tài nguyên sân mới'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="px-4 pb-4 bg-white">
            <Tabs defaultActiveKey="info" className="mb-4 custom-admin-tabs border-bottom">

              <Tab eventKey="info" title="THÔNG TIN CHUNG">
                <Row className="g-4">
                  <Col lg={8}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-bold small text-secondary mb-2">MÔ TẢ CHI TIẾT SÂN BÃI</Form.Label>
                      <div style={{ height: '280px', marginBottom: '40px' }} className="quill-wrapper-premium rounded-3 overflow-hidden border">
                        <ReactQuill theme="snow" value={formData.description} onChange={(val) => setFormData({ ...formData, description: val })} style={{ height: '230px' }} />
                      </div>
                    </Form.Group>
                    <Form.Group>
                      <Form.Label className="fw-bold small text-secondary">ĐỊA CHỈ TOÀN DIỆN *</Form.Label>
                      <Form.Control className="py-2 rounded-3 text-dark font-medium" placeholder="Nhập địa chỉ cụ thể..." value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                    </Form.Group>
                  </Col>
                  <Col lg={4}>
                    <div className="p-3 rounded-4 border bg-light bg-opacity-50">
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold small text-secondary">ẢNH BÌA ĐẠI DIỆN</Form.Label>
                        <div className="position-relative mb-2 rounded-4 overflow-hidden border bg-white shadow-xs admin-cover-box" style={{ height: 160 }}>
                          {formData.image ? <img src={formData.image} className="w-100 h-100 object-fit-cover" alt="cover" /> : <div className="d-flex align-items-center justify-content-center h-100 text-muted small">Chưa có ảnh bìa</div>}
                          <label className="position-absolute bottom-0 end-0 bg-success text-white p-2.5 rounded-start-4 cursor-pointer shadow-sm">
                            <CloudUpload size={16} />
                            <input type="file" hidden onChange={(e) => handleFileUpload(e, false)} />
                          </label>
                        </div>
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold small text-secondary">TÊN SÂN BÃI *</Form.Label>
                        <Form.Control className="py-2 rounded-3 text-dark" placeholder="Nhập tên sân bóng..." value={formData.fieldName} onChange={e => setFormData({ ...formData, fieldName: e.target.value })} />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold small text-secondary">PHÂN HỆ THỂ THAO</Form.Label>
                        <Form.Select className="py-2 rounded-3 text-dark" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                          <option value="Bóng đá">Bóng đá</option>
                          <option value="Pickleball">Pickleball</option>
                          <option value="Cầu lông">Cầu lông</option>
                          <option value="Tennis">Tennis</option>
                        </Form.Select>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold small text-secondary">TRẠNG THÁI VẬN HÀNH</Form.Label>
                        <Form.Select className="py-2 rounded-3 text-dark fw-bold" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                          <option value="Active" style={{ color: '#198754' }}>🟢 Hoạt động (Active)</option>
                          <option value="Maintenance" style={{ color: '#dc3545' }}>🔴 Bảo trì (Maintenance)</option>
                          <option value="Full" style={{ color: '#ffc107' }}>🟡 Hết sân (Full)</option>
                        </Form.Select>
                      </Form.Group>

                      <Form.Check type="switch" id="custom-switch" label="Thiết lập làm sân nổi bật" checked={formData.isFeatured} onChange={e => setFormData({ ...formData, isFeatured: e.target.checked })} className="fw-bold text-success pt-1" />
                    </div>
                  </Col>
                </Row>
              </Tab>

              <Tab eventKey="media" title="HÌNH ẢNH & DỊCH VỤ">
                <Row className="g-4">
                  <Col md={7}>
                    <Form.Label className="fw-bold small text-secondary mb-2">BỘ SƯU TẬP ẢNH BỔ TRỢ (GALLERY)</Form.Label>
                    <div className="d-flex gap-3 flex-wrap p-3 border rounded-4 bg-white shadow-xs border-dashed-premium">
                      {formData.gallery?.map((img, i) => (
                        <div key={i} className="position-relative group-gallery rounded-3 overflow-hidden border border-light shadow-xs" style={{ width: 135, height: 90 }}>
                          <img src={img} className="w-100 h-100 object-fit-cover" alt="gallery" />
                          <button type="button" className="position-absolute top-0 end-0 p-1 m-1 border-0 bg-danger text-white rounded-circle btn-del flex-center" onClick={() => setFormData({ ...formData, gallery: formData.gallery.filter((_, idx) => idx !== i) })} style={{ width: 20, height: 20 }}>
                            <Trash size={10} />
                          </button>
                        </div>
                      ))}
                      <label className="border-dashed-add rounded-3 d-flex flex-column align-items-center justify-content-center bg-light" style={{ width: 135, height: 90, cursor: 'pointer' }}>
                        {uploading ? <Spinner animation="border" size="sm" variant="success" /> : <><CloudUpload size={20} className="text-muted mb-1" /><span className="text-muted" style={{ fontSize: 11, fontWeight: 600 }}>Thêm ảnh</span></>}
                        <input type="file" hidden onChange={(e) => handleFileUpload(e, true)} />
                      </label>
                    </div>
                  </Col>
                  <Col md={5}>
                    <Form.Label className="fw-bold small text-secondary mb-2">TIỆN ÍCH KHU VỰC MIỄN PHÍ</Form.Label>
                    <Card className="p-3 border-0 bg-light rounded-4 bg-opacity-60 shadow-xs">
                      {formData.services?.map((service, idx) => (
                        <div key={idx} className="d-flex align-items-center justify-content-between py-2.5 border-bottom last-border-0">
                          <span className="small fw-bold text-secondary">{service.name}</span>
                          <Form.Check type="switch" id={`service-sw-${idx}`} checked={service.isAvailable} onChange={e => {
                            const newServices = [...formData.services];
                            newServices[idx].isAvailable = e.target.checked;
                            setFormData({ ...formData, services: newServices });
                          }} />
                        </div>
                      ))}
                    </Card>
                  </Col>
                </Row>
              </Tab>

              <Tab eventKey="pricing" title="CẤU HÌNH BẢNG GIÁ LINH HOẠT">
                <div className="p-3 rounded-4 border bg-light bg-opacity-40">
                  <div className="d-flex justify-content-between align-items-center mb-3 px-1">
                    <div>
                      <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-1">
                        <DollarSign size={16} className="text-success" /> Đơn giá cấu hình giờ linh hoạt
                      </h6>
                    </div>
                    <Button variant="success" size="sm" className="rounded-3 fw-bold shadow-xs px-3 py-1.5 d-flex align-items-center gap-1" onClick={handleAddPricingRule}>
                      <Plus size={16} /> Thêm khung giờ mới
                    </Button>
                  </div>

                  {(!formData.pricingRules || formData.pricingRules.length === 0) ? (
                    <div className="text-center py-5 bg-white rounded-4 border border-dashed text-muted small fst-italic">
                      Chưa cấu hình đơn giá. Hệ thống sẽ hiển thị nhãn "Liên hệ" ngoài Client.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {formData.pricingRules.map((rule, idx) => (
                        <Card key={idx} className="premium-price-card border-0 shadow-none overflow-hidden">
                          <Card.Body className="p-0">
                            <div className="pricing-row-grid">

                              {/* 1. Tên khung giờ */}
                              <div>
                                <Form.Label className="small-label-premium"><Layers size={11} />Tên khung giờ *</Form.Label>
                                <Form.Control size="sm" className="custom-input-premium text-dark" placeholder="Ví dụ: Giờ vàng tối" value={rule.ruleName} onChange={e => handlePricingRuleChange(idx, 'ruleName', e.target.value)} />
                              </div>

                              {/* 2. Loại ngày */}
                              <div>
                                <Form.Label className="small-label-premium"><CalendarDays size={11} />Ngày áp dụng</Form.Label>
                                <Form.Select size="sm" className="custom-select-premium text-dark" value={rule.dayType} onChange={e => handlePricingRuleChange(idx, 'dayType', e.target.value)}>
                                  <option value="Weekday">Ngày thường (T2-T6)</option>
                                  <option value="Weekend">Cuối tuần (T7-CN)</option>
                                  <option value="Holiday">Ngày Lễ Tết</option>
                                </Form.Select>
                              </div>

                              {/* 3. Thời gian hoạt động */}
                              <div>
                                <Form.Label className="small-label-premium"><Clock size={11} />Thời gian hoạt động</Form.Label>
                                <div className="d-flex align-items-center gap-2">
                                  <Form.Control size="sm" className="text-center custom-input-premium font-code text-dark" placeholder="05:00" value={rule.startTime} onChange={e => handlePricingRuleChange(idx, 'startTime', e.target.value)} />
                                  <span className="text-muted-light small font-medium">—</span>
                                  <Form.Control size="sm" className="text-center custom-input-premium font-code text-dark" placeholder="22:00" value={rule.endTime} onChange={e => handlePricingRuleChange(idx, 'endTime', e.target.value)} />
                                </div>
                              </div>

                              {/* 4. Đơn giá */}
                              <div>
                                <Form.Label className="small-label-premium"><DollarSign size={11} />Đơn giá (VND/h) *</Form.Label>
                                <InputGroup size="sm" className="rounded-3 border overflow-hidden input-group-premium shadow-none">
                                  <Form.Control type="number" className="border-0 shadow-none text-dark fw-bold text-end pe-2 bg-transparent" placeholder="150000" value={rule.price} onChange={e => handlePricingRuleChange(idx, 'price', Number(e.target.value))} />
                                  <InputGroup.Text className="bg-transparent border-0 small text-secondary font-semibold" style={{ fontSize: 11, paddingLeft: 4, paddingRight: 6 }}>đ/h</InputGroup.Text>
                                </InputGroup>
                              </div>

                              {/* 5. Giờ cao điểm Toggle */}
                              <div className="text-center">
                                <Form.Label className="small-label-premium justify-content-center">HOT</Form.Label>
                                <Form.Check
                                  type="checkbox"
                                  id={`peak-toggle-${idx}`}
                                  className="peak-checkbox-premium"
                                  checked={rule.isPeakHour}
                                  onChange={e => handlePricingRuleChange(idx, 'isPeakHour', e.target.checked)}
                                />
                              </div>

                              {/* 6. Nút xóa dòng inline */}
                              <div className="text-center">
                                <Form.Label className="small-label-premium justify-content-center">Xóa</Form.Label>
                                <button type="button" className="btn-remove-rule-inline border-0 bg-transparent w-100" onClick={() => handleRemovePricingRule(idx)}>
                                  <Trash2 size={16} />
                                </button>
                              </div>

                            </div>
                          </Card.Body>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </Tab>
            </Tabs>
          </Modal.Body>
          <Modal.Footer className="border-top-0 px-4 pb-4 bg-white rounded-bottom-4">
            <Button variant="light" className="rounded-3 px-4 py-2 border font-semibold text-secondary" onClick={() => { setShowModal(false); fetchFields(); }}>Hủy bỏ</Button>
            <Button variant="success" type="submit" className="rounded-3 px-5 py-2 fw-bold shadow-sm" disabled={loading || uploading}>
              {loading ? <Spinner size="sm" className="me-1" /> : 'XÁC NHẬN LƯU HỆ THỐNG'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default FieldManager;