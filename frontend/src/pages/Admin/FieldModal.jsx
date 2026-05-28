import React, { useState } from 'react';
import { Modal, Form, Button, Row, Col, Spinner, Tabs, Tab, InputGroup, Card } from 'react-bootstrap';
import { CloudUpload, Trash, DollarSign, Clock, Layers, CalendarDays, Plus, Trash2 } from 'lucide-react';
import axios from 'axios';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import ReactQuill from 'react-quill-new';

const FieldModal = ({ show, onHide, formData, setFormData, fetchFields }) => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e, isGallery = false) => {
    const file = e.target.files[0];
    if (!file) return;
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', 'arenahub_preset');
    try {
      setUploading(true);
      const res = await axios.post(`https://api.cloudinary.com/v1_1/dp8zttoxz/image/upload`, data);
      if (isGallery) setFormData(prev => ({ ...prev, gallery: [...prev.gallery, res.data.secure_url] }));
      else setFormData(prev => ({ ...prev, image: res.data.secure_url }));
    } catch (err) { Swal.fire('Lỗi', 'Upload ảnh thất bại', 'error'); }
    finally { setUploading(false); }
  };

  const handlePricingRuleChange = (idx, field, value) => {
    const rules = [...formData.pricingRules];
    rules[idx][field] = value;
    setFormData({ ...formData, pricingRules: rules });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const sanitizedRules = formData.pricingRules.map(r => ({ ...r, price: Number(r.price) }));
    const dataToSend = { ...formData, pricingRules: JSON.stringify(sanitizedRules) };

    try {
      if (formData._id) await axiosClient.put(`/admin/fields/${formData._id}`, dataToSend);
      else await axiosClient.post('/admin/fields', dataToSend);
      Swal.fire('Thành công', 'Đã lưu sân!', 'success');
      onHide();
      fetchFields();
    } catch (err) { Swal.fire('Lỗi', err.response?.data?.message || 'Có lỗi!', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered backdrop="static">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton><h5>{formData._id ? 'Cập nhật sân' : 'Thêm sân mới'}</h5></Modal.Header>
        <Modal.Body>
          <Tabs defaultActiveKey="info">
            <Tab eventKey="info" title="Thông tin chung">
               {/* Giữ nguyên code Form thông tin chung của bạn ở đây */}
            </Tab>
            <Tab eventKey="pricing" title="Cấu hình giá">
               {/* Giữ nguyên code PricingRules của bạn ở đây */}
            </Tab>
          </Tabs>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Hủy</Button>
          <Button type="submit" variant="success" disabled={loading}>{loading ? <Spinner size="sm"/> : 'Lưu'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};
export default FieldModal;