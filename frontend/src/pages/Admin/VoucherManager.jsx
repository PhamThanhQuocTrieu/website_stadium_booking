import React, { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Table, Button, Form, Modal, Badge, Spinner, InputGroup, Pagination } from 'react-bootstrap';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, BarChart3, CheckCircle, Edit2, Plus, Save, Search, Ticket, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import api from '../../api/api';
import '../../styles/admin/admin-common.css';

const ITEMS_PER_PAGE = 8;

const sportOptions = ['Bóng đá', 'Cầu lông', 'Tennis', 'Pickleball'];
const dayOptions = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 0, label: 'Chủ nhật' }
];

const initialForm = {
  code: '',
  name: '',
  discountType: 'percent',
  discountValue: '',
  maxDiscount: '',
  minOrderAmount: '',
  usageLimit: '',
  perUserLimit: 1,
  applyType: 'all',
  fieldIds: [],
  sportTypes: [],
  validDays: [],
  validTimeFrom: '08:00',
  validTimeTo: '15:00',
  autoAssignNewUser: false,
  status: 'active',
  startDate: '',
  endDate: ''
};

const getFieldsFromResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.fields)) return data.fields;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const formatCurrency = (amount) => Number(amount || 0).toLocaleString('vi-VN');
const toDateInput = (value) => value ? String(value).split('T')[0] : '';
const getStatus = (voucher) => {
  if (voucher.endDate && new Date(voucher.endDate) < new Date()) return 'expired';
  return String(voucher.status || 'active').toLowerCase();
};
const getStatusBadge = (status) => {
  const map = { active: 'success', inactive: 'secondary', draft: 'warning', expired: 'danger', pending: 'info' };
  return map[status] || 'secondary';
};
const getScopeLabel = (type) => ({
  all: 'Toàn hệ thống',
  new_user: 'Khách hàng mới',
  field: 'Theo sân',
  sport_type: 'Theo môn',
  time_slot: 'Theo khung giờ',
  weekend: 'Cuối tuần'
}[type] || 'Toàn hệ thống');

const normalizeVoucherToForm = (voucher) => ({
  ...initialForm,
  ...voucher,
  discountType: voucher.discountType || 'percent',
  discountValue: voucher.discountValue ?? voucher.discountPercent ?? '',
  minOrderAmount: voucher.minOrderAmount ?? voucher.minOrderValue ?? '',
  usedCount: voucher.usedCount ?? voucher.usageCount ?? 0,
  fieldIds: (voucher.fieldIds || voucher.applicableFields || []).map(String),
  sportTypes: voucher.sportTypes || [],
  validDays: voucher.validDays || [],
  autoAssignNewUser: Boolean(voucher.autoAssignNewUser),
  status: getStatus(voucher) === 'expired' ? 'inactive' : getStatus(voucher),
  startDate: toDateInput(voucher.startDate),
  endDate: toDateInput(voucher.endDate)
});

const VoucherManager = () => {
  const [vouchers, setVouchers] = useState([]);
  const [allFields, setAllFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchVouchers();
    fetchFields();
  }, []);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/vouchers');
      setVouchers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      Swal.fire('Loi', 'Không tải được danh sách voucher', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async () => {
    try {
      const res = await api.get('/admin/fields');
      setAllFields(getFieldsFromResponse(res.data));
    } catch (err) {
      try {
        const fallbackRes = await api.get('/fields');
        setAllFields(getFieldsFromResponse(fallbackRes.data));
      } catch (fallbackErr) {
        setAllFields([]);
        console.error('Không tải được danh sách sân:', fallbackErr);
      }
    }
  };

  const openModal = (voucher = null) => {
    setEditingId(voucher?._id || null);
    setFormData(voucher ? normalizeVoucherToForm(voucher) : initialForm);
    setShowModal(true);
  };

  const openNewUserVoucherTemplate = () => {
    const today = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    setEditingId(null);
    setFormData({
      ...initialForm,
      code: 'WELCOME20',
      name: 'Ưu đãi khách hàng mới',
      discountType: 'percent',
      discountValue: 20,
      maxDiscount: 50000,
      minOrderAmount: 100000,
      usageLimit: 999999,
      usedCount: 0,
      perUserLimit: 1,
      applyType: 'new_user',
      autoAssignNewUser: true,
      status: 'active',
      startDate: today.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const openWeekendVoucherTemplate = () => {
    const today = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3);
    setEditingId(null);
    setFormData({
      ...initialForm,
      code: 'WEEKEND25',
      name: 'Ưu đãi cuối tuần',
      discountType: 'percent',
      discountValue: 25,
      maxDiscount: 0,
      minOrderAmount: 0,
      usageLimit: 200,
      usedCount: 0,
      perUserLimit: 1,
      applyType: 'weekend',
      status: 'active',
      startDate: today.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const updateForm = (key, value) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'applyType') {
        next.autoAssignNewUser = value === 'new_user' ? prev.autoAssignNewUser : false;
        if (value !== 'field') next.fieldIds = [];
        if (value !== 'sport_type') next.sportTypes = [];
        if (value !== 'time_slot') next.validDays = [];
      }
      return next;
    });
  };

  const toggleArrayValue = (key, value) => {
    setFormData((prev) => {
      const list = prev[key] || [];
      return {
        ...prev,
        [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
      };
    });
  };

  const handleSave = async () => {
    if (formData.applyType === 'field' && (!Array.isArray(formData.fieldIds) || formData.fieldIds.length === 0)) {
      Swal.fire('Thiếu thông tin', 'Vui lòng chọn ít nhất một sân áp dụng.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const fieldIds = formData.applyType === 'field' ? formData.fieldIds : [];
      const payload = {
        ...formData,
        discountValue: Number(formData.discountValue || 0),
        discountPercent: formData.discountType === 'percent' ? Number(formData.discountValue || 0) : 0,
        maxDiscount: Number(formData.maxDiscount || 0),
        minOrderAmount: Number(formData.minOrderAmount || 0),
        minOrderValue: Number(formData.minOrderAmount || 0),
        usageLimit: Number(formData.usageLimit || 100),
        perUserLimit: Number(formData.perUserLimit || 1),
        fieldIds,
        applicableFields: fieldIds,
        autoAssignNewUser: formData.applyType === 'new_user' && formData.autoAssignNewUser
      };

      if (editingId) {
        await api.put(`/admin/vouchers/${editingId}`, payload);
        Swal.fire('Thành công', 'Đã cập nhật mã thành công', 'success');
      } else {
        await api.post('/admin/vouchers', payload);
        Swal.fire('Thành công', 'Đã tạo mã mới thành công', 'success');
      }
      setShowModal(false);
      fetchVouchers();
    } catch (err) {
      Swal.fire(' lỗi', err.response?.data?.message || 'Có lỗi xảy ra', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, code) => {
    const result = await Swal.fire({
      title: 'Xác nhận xóa?',
      text: `Bạn có chắc muốn xóa mã ${code}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Xóa'
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/admin/vouchers/${id}`);
      Swal.fire('Đã xóa', 'Mã đã được xóa thành công', 'success');
      fetchVouchers();
    } catch (err) {
      Swal.fire(' lỗi', 'Không thể xóa mã này', 'error');
    }
  };

  const filteredVouchers = useMemo(() => {
    const keyword = searchTerm.toLowerCase();
    return vouchers.filter((voucher) => (
      voucher.code?.toLowerCase().includes(keyword) ||
      voucher.name?.toLowerCase().includes(keyword)
    ));
  }, [vouchers, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredVouchers.length / ITEMS_PER_PAGE));
  const paginatedVouchers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredVouchers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredVouchers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const metrics = useMemo(() => ([
    { title: 'Tổng mã', value: vouchers.length, icon: <Ticket />, color: 'text-primary' },
    { title: 'Đang hoạt động', value: vouchers.filter((v) => getStatus(v) === 'active').length, icon: <CheckCircle />, color: 'text-success' },
    { title: 'Đã hết hạn', value: vouchers.filter((v) => getStatus(v) === 'expired').length, icon: <AlertTriangle />, color: 'text-danger' },
    { title: 'Tổng lượt dùng', value: vouchers.reduce((acc, v) => acc + Number(v.usedCount ?? v.usageCount ?? 0), 0), icon: <BarChart3 />, color: 'text-info' }
  ]), [vouchers]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
      <div className="admin-page-heading">
        <div>
          <span>ARENAHUB ADMIN</span>
          <h1>Quản lý mã giảm giá</h1>
          <p>Tạo, theo dõi và quản lý các chương trình ưu đãi dành cho người dùng.</p>
        </div>
      </div>

      <Row className="mb-4 g-3">
        {metrics.map((item) => (
          <Col md={3} sm={6} key={item.title}>
            <Card className="border-0 shadow-sm p-3 h-100">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <p className="text-muted mb-1">{item.title}</p>
                  <h4 className="fw-bold mb-0">{item.value}</h4>
                </div>
                <div className={item.color}>{item.icon}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <div className="d-flex flex-wrap justify-content-between gap-3 mb-4">
        <InputGroup style={{ maxWidth: 340 }}>
          <InputGroup.Text><Search size={18} /></InputGroup.Text>
          <Form.Control placeholder="Tìm mã hoặc tên chương trình..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </InputGroup>
        <div className="d-flex flex-wrap gap-2">
          <Button variant="outline-success" onClick={openNewUserVoucherTemplate}>
            Mẫu khách hàng mới
          </Button>
          <Button variant="outline-success" onClick={openWeekendVoucherTemplate}>
            Mẫu cuối tuần
          </Button>
          <Button variant="success" onClick={() => openModal()} className="d-inline-flex align-items-center gap-2">
            <Plus size={20} /> Tạo mã mới
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <Table hover responsive className="align-middle mb-0">
          <thead className="bg-light">
            <tr>
              <th>Mã</th>
              <th>Tên chương trình</th>
              <th>Loại giảm</th>
              <th>Giá trị</th>
              <th>Phạm vi</th>
              <th>Đã dùng / Giới hạn</th>
              <th>Ngày hết hạn</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {loading ? (
                <tr><td colSpan="9" className="text-center p-5"><Spinner animation="border" /></td></tr>
              ) : filteredVouchers.length === 0 ? (
                <tr><td colSpan="9" className="text-center text-muted p-5">Chưa có voucher phù hợp</td></tr>
              ) : paginatedVouchers.map((voucher) => {
                const status = getStatus(voucher);
                const discountValue = voucher.discountValue ?? voucher.discountPercent ?? 0;
                return (
                  <motion.tr key={voucher._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td className="fw-bold text-primary">{voucher.code}</td>
                    <td>{voucher.name}</td>
                    <td>{voucher.discountType === 'fixed' ? 'Số tiền cố định' : 'Theo %'}</td>
                    <td>{voucher.discountType === 'fixed' ? `${formatCurrency(discountValue)}d` : `${discountValue}%`}</td>
                    <td>{getScopeLabel(voucher.applyType)}</td>
                    <td>{voucher.usedCount ?? voucher.usageCount ?? 0}/{voucher.usageLimit || 0}</td>
                    <td>{voucher.endDate ? new Date(voucher.endDate).toLocaleDateString('vi-VN') : '-'}</td>
                    <td><Badge bg={getStatusBadge(status)}>{status}</Badge></td>
                    <td>
                      <Button variant="outline-primary" size="sm" className="me-2" onClick={() => openModal(voucher)}><Edit2 size={16} /></Button>
                      <Button variant="outline-danger" size="sm" onClick={() => handleDelete(voucher._id, voucher.code)}><Trash2 size={16} /></Button>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </Table>
        {!loading && filteredVouchers.length > ITEMS_PER_PAGE && (
          <Card.Footer className="bg-white border-0 pt-0">
            <div className="admin-pagination-shell">
              <span>Hiển thị {paginatedVouchers.length} / {filteredVouchers.length} mã giảm giá</span>
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

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>{editingId ? 'Chỉnh sửa mã' : 'Tạo mã mới'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <h6 className="fw-bold text-success mb-3">Thông tin mã</h6>
            <Row>
              <Col md={5}><Form.Group className="mb-3"><Form.Label>Mã code</Form.Label><Form.Control value={formData.code} onChange={(e) => updateForm('code', e.target.value.toUpperCase())} /></Form.Group></Col>
              <Col md={7}><Form.Group className="mb-3"><Form.Label>Tên chương trình</Form.Label><Form.Control value={formData.name} onChange={(e) => updateForm('name', e.target.value)} /></Form.Group></Col>
            </Row>

            <h6 className="fw-bold text-success mt-2 mb-3">Điều kiện giảm</h6>
            <Row>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>Loại giảm</Form.Label><Form.Select value={formData.discountType} onChange={(e) => updateForm('discountType', e.target.value)}><option value="percent">Giảm theo %</option><option value="fixed">Giảm số tiền cố định</option></Form.Select></Form.Group></Col>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>Giá trị giảm</Form.Label><Form.Control type="number" min="0" value={formData.discountValue} onChange={(e) => updateForm('discountValue', e.target.value)} /></Form.Group></Col>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>Giảm tối đa</Form.Label><Form.Control type="number" min="0" value={formData.maxDiscount} onChange={(e) => updateForm('maxDiscount', e.target.value)} disabled={formData.discountType === 'fixed'} /></Form.Group></Col>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>Min đơn</Form.Label><Form.Control type="number" min="0" value={formData.minOrderAmount} onChange={(e) => updateForm('minOrderAmount', e.target.value)} /></Form.Group></Col>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>Lượt dùng</Form.Label><Form.Control type="number" min="1" value={formData.usageLimit} onChange={(e) => updateForm('usageLimit', e.target.value)} /></Form.Group></Col>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>Giới hạn user tối đa</Form.Label><Form.Control type="number" min="1" value={formData.perUserLimit} onChange={(e) => updateForm('perUserLimit', e.target.value)} /></Form.Group></Col>
            </Row>

            <h6 className="fw-bold text-success mt-2 mb-3">Phạm vi áp dụng</h6>
            <Row>
              <Col md={6}><Form.Group className="mb-3"><Form.Label>Loại áp dụng</Form.Label><Form.Select value={formData.applyType} onChange={(e) => updateForm('applyType', e.target.value)}><option value="all">Toàn hệ thống</option><option value="new_user">Khách hàng mới</option><option value="field">Theo sân</option><option value="sport_type">Theo môn thể thao</option><option value="time_slot">Theo khung giờ</option><option value="weekend">Cuối tuần - thứ 7 & chủ nhật</option></Form.Select></Form.Group></Col>
              <Col md={6} className="d-flex align-items-end"><Form.Check className="mb-3" type="checkbox" label="Tự động tặng cho user mới" checked={formData.autoAssignNewUser} disabled={formData.applyType !== 'new_user'} onChange={(e) => updateForm('autoAssignNewUser', e.target.checked)} /></Col>
            </Row>

            {formData.applyType === 'field' && (
              <Form.Group className="mb-3">
                <Form.Label>Chọn sân áp dụng</Form.Label>
                <div className="p-3 border rounded bg-light" style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {allFields.length === 0 ? (
                    <div className="text-muted small">Chưa tải được danh sách sân. Vui lòng thử tải lại trang.</div>
                  ) : allFields.map((field) => (
                    <Form.Check
                      key={field._id}
                      type="checkbox"
                      label={`${field.fieldName || field.name || 'Sân'}${field.type ? ` - ${field.type}` : ''}`}
                      checked={formData.fieldIds.includes(String(field._id))}
                      onChange={() => toggleArrayValue('fieldIds', String(field._id))}
                      className="mb-2"
                    />
                  ))}
                </div>
                <Form.Text className="text-muted">Voucher Theo sân chỉ áp dụng cho các sân được chọn ở đây.</Form.Text>
              </Form.Group>
            )}

            {formData.applyType === 'sport_type' && (
              <Form.Group className="mb-3">
                <Form.Label>Môn thể thao áp dụng</Form.Label>
                <div className="d-flex flex-wrap gap-3">
                  {sportOptions.map((sport) => <Form.Check key={sport} type="checkbox" label={sport} checked={formData.sportTypes.includes(sport)} onChange={() => toggleArrayValue('sportTypes', sport)} />)}
                </div>
              </Form.Group>
            )}

            {formData.applyType === 'time_slot' && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Ngày áp dụng</Form.Label>
                  <div className="d-flex flex-wrap gap-3">
                    {dayOptions.map((day) => <Form.Check key={day.value} type="checkbox" label={day.label} checked={formData.validDays.includes(day.value)} onChange={() => toggleArrayValue('validDays', day.value)} />)}
                  </div>
                </Form.Group>
                <Row>
                  <Col md={6}><Form.Group className="mb-3"><Form.Label>Từ giờ</Form.Label><Form.Control type="time" value={formData.validTimeFrom} onChange={(e) => updateForm('validTimeFrom', e.target.value)} /></Form.Group></Col>
                  <Col md={6}><Form.Group className="mb-3"><Form.Label>Đến giờ</Form.Label><Form.Control type="time" value={formData.validTimeTo} onChange={(e) => updateForm('validTimeTo', e.target.value)} /></Form.Group></Col>
                </Row>
              </>
            )}

            <h6 className="fw-bold text-success mt-2 mb-3">Thời gian & trạng thái</h6>
            <Row>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>Ngày bắt đầu</Form.Label><Form.Control type="date" value={formData.startDate} onChange={(e) => updateForm('startDate', e.target.value)} /></Form.Group></Col>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>Ngày kết thúc</Form.Label><Form.Control type="date" value={formData.endDate} onChange={(e) => updateForm('endDate', e.target.value)} /></Form.Group></Col>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>Trạng thái</Form.Label><Form.Select value={formData.status} onChange={(e) => updateForm('status', e.target.value)}><option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option></Form.Select></Form.Group></Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Hủy</Button>
          <Button variant="success" onClick={handleSave} disabled={submitting} className="d-inline-flex align-items-center gap-2">
            {submitting ? <Spinner animation="border" size="sm" /> : <Save size={18} />}
            {editingId ? 'Cập nhật' : 'Lưu mã'}
          </Button>
        </Modal.Footer>
      </Modal>
    </motion.div>
  );
};

export default VoucherManager;
