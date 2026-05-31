import React, { useState, useEffect, useMemo } from 'react';
import { Row, Col, Card, Table, Button, Form, Modal, Badge, Spinner, InputGroup } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, Ticket, BarChart3, CheckCircle, AlertTriangle, Save, X } from 'lucide-react';
import Swal from 'sweetalert2';
import api from '../../api/api';

const VoucherManager = () => {
  const [vouchers, setVouchers] = useState([]);
  const [allFields, setAllFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const initialForm = { 
    code: '', name: '', discountPercent: '', maxDiscount: '', 
    minOrderValue: '', usageLimit: '', startDate: '', endDate: '',
    applicableFields: [] 
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => { 
    fetchVouchers(); 
    fetchFields(); 
  }, []);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/vouchers');
      setVouchers(res.data);
    } catch (err) { Swal.fire('Lỗi', 'Không tải được danh sách voucher', 'error'); }
    finally { setLoading(false); }
  };

  const fetchFields = async () => {
    try {
      const res = await api.get('/admin/fields'); 
      setAllFields(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error("Không lấy được danh sách sân"); }
  };

  const openModal = (voucher = null) => {
    if (voucher) {
      setEditingId(voucher._id);
      setFormData({
        ...voucher,
        startDate: voucher.startDate ? voucher.startDate.split('T')[0] : '',
        endDate: voucher.endDate ? voucher.endDate.split('T')[0] : '',
        applicableFields: voucher.applicableFields || []
      });
    } else {
      setEditingId(null);
      setFormData(initialForm);
    }
    setShowModal(true);
  };

  const toggleField = (fieldId) => {
    setFormData(prev => {
      const isSelected = prev.applicableFields.includes(fieldId);
      return {
        ...prev,
        applicableFields: isSelected 
          ? prev.applicableFields.filter(id => id !== fieldId)
          : [...prev.applicableFields, fieldId]
      };
    });
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/admin/vouchers/${editingId}`, formData);
        Swal.fire('Thành công', 'Đã cập nhật mã thành công!', 'success');
      } else {
        await api.post('/admin/vouchers', formData);
        Swal.fire('Thành công', 'Đã tạo mã mới thành công!', 'success');
      }
      setShowModal(false);
      fetchVouchers();
    } catch (err) { 
      Swal.fire('Lỗi', err.response?.data?.message || 'Có lỗi xảy ra', 'error'); 
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, code) => {
    const result = await Swal.fire({ 
      title: 'Xác nhận xóa?', text: `Bạn có chắc muốn xóa mã ${code}?`, 
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Xóa' 
    });
    if (result.isConfirmed) {
      try { 
        await api.delete(`/admin/vouchers/${id}`); 
        Swal.fire('Đã xóa', 'Mã đã được xóa thành công', 'success');
        fetchVouchers(); 
      } catch (err) { Swal.fire('Lỗi', 'Không thể xóa mã này', 'error'); }
    }
  };

  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v => v.code.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [vouchers, searchTerm]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
      {/* 4 THẺ DASHBOARD CỦA BẠN */}
      <Row className="mb-4">
        {[
          { title: 'Tổng mã', value: vouchers.length, icon: <Ticket />, color: 'text-primary' },
          { title: 'Đang hoạt động', value: vouchers.filter(v => v.status === 'Active').length, icon: <CheckCircle />, color: 'text-success' },
          { title: 'Hết hạn', value: vouchers.filter(v => v.status === 'Expired').length, icon: <AlertTriangle />, color: 'text-danger' },
          { title: 'Tổng lượt dùng', value: vouchers.reduce((acc, v) => acc + v.usageCount, 0), icon: <BarChart3 />, color: 'text-info' },
        ].map((item, i) => (
          <Col md={3} key={i}>
            <Card className="border-0 shadow-sm p-3">
              <div className="d-flex align-items-center justify-content-between">
                <div><p className="text-muted mb-1">{item.title}</p><h4 className="fw-bold">{item.value}</h4></div>
                <div className={item.color}>{item.icon}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <div className="d-flex justify-content-between mb-4">
        <InputGroup style={{ width: '300px' }}>
          <InputGroup.Text><Search size={18} /></InputGroup.Text>
          <Form.Control placeholder="Tìm mã..." onChange={(e) => setSearchTerm(e.target.value)} />
        </InputGroup>
        <Button variant="success" onClick={() => openModal()}><Plus size={20} /> Tạo mã mới</Button>
      </div>

      <Card className="border-0 shadow-sm">
        <Table hover responsive className="align-middle mb-0">
          <thead className="bg-light">
            <tr><th>Mã</th><th>Tên</th><th>Giá trị</th><th>Min đơn</th><th>Lượt dùng</th><th>Hạn dùng</th><th>Trạng thái</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {loading ? <tr><td colSpan="8" className="text-center p-5"><Spinner animation="border" /></td></tr> : 
                filteredVouchers.map(v => (
                  <motion.tr key={v._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td className="fw-bold text-primary">{v.code}</td>
                    <td>{v.name}</td>
                    <td>{v.discountPercent}%</td>
                    <td>{v.minOrderValue.toLocaleString()}đ</td>
                    <td>{v.usageCount}/{v.usageLimit}</td>
                    <td>{new Date(v.endDate).toLocaleDateString()}</td>
                    <td><Badge bg={v.status === 'Active' ? 'success' : 'danger'}>{v.status}</Badge></td>
                    <td>
                      <Button variant="outline-primary" size="sm" className="me-2" onClick={() => openModal(v)}><Edit2 size={16} /></Button>
                      <Button variant="outline-danger" size="sm" onClick={() => handleDelete(v._id, v.code)}><Trash2 size={16} /></Button>
                    </td>
                  </motion.tr>
                ))
              }
            </AnimatePresence>
          </tbody>
        </Table>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>{editingId ? 'Chỉnh sửa mã' : 'Tạo mã mới'}</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}><Form.Group className="mb-3"><Form.Label>Mã Code</Form.Label><Form.Control value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} /></Form.Group></Col>
              <Col md={6}><Form.Group className="mb-3"><Form.Label>Tên chương trình</Form.Label><Form.Control value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} /></Form.Group></Col>
            </Row>
            <Row>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>% Giảm</Form.Label><Form.Control type="number" value={formData.discountPercent} onChange={(e) => setFormData({...formData, discountPercent: e.target.value})} /></Form.Group></Col>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>Giảm tối đa (đ)</Form.Label><Form.Control type="number" value={formData.maxDiscount} onChange={(e) => setFormData({...formData, maxDiscount: e.target.value})} /></Form.Group></Col>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>Min đơn (đ)</Form.Label><Form.Control type="number" value={formData.minOrderValue} onChange={(e) => setFormData({...formData, minOrderValue: e.target.value})} /></Form.Group></Col>
            </Row>
            <Row>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>Lượt dùng</Form.Label><Form.Control type="number" value={formData.usageLimit} onChange={(e) => setFormData({...formData, usageLimit: e.target.value})} /></Form.Group></Col>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>Ngày bắt đầu</Form.Label><Form.Control type="date" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} /></Form.Group></Col>
              <Col md={4}><Form.Group className="mb-3"><Form.Label>Ngày kết thúc</Form.Label><Form.Control type="date" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} /></Form.Group></Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label><strong>Chọn sân áp dụng:</strong></Form.Label>
              <div className="p-3 border rounded" style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
                {allFields.map(field => (
                  <Form.Check 
                    key={field._id}
                    type="checkbox"
                    label={field.name || field.fieldName}
                    checked={formData.applicableFields.includes(field._id)}
                    onChange={() => toggleField(field._id)}
                    className="mb-2"
                  />
                ))}
              </div>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Hủy</Button>
          <Button variant="success" onClick={handleSave} disabled={submitting}>{editingId ? 'Cập nhật' : 'Lưu mã'}</Button>
        </Modal.Footer>
      </Modal>
    </motion.div>
  );
};

export default VoucherManager;