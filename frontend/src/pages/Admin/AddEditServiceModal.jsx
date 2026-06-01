import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Spinner } from 'react-bootstrap';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import { CloudUpload } from 'lucide-react';

const AddEditServiceModal = ({ show, handleClose, service, refreshData }) => {
    const [formData, setFormData] = useState({ 
        name: '', price: '', description: '', stock: 0, image: '', isActive: true, appliedFields: [] 
    });
    const [fields, setFields] = useState([]); // Danh sách sân từ API
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        // Load danh sách sân khi modal mở
        const loadFields = async () => {
            try {
                const { data } = await axiosClient.get('/fields');
                setFields(data);
            } catch (err) { 
                console.error("Không thể tải danh sách sân"); 
            }
        };
        loadFields();

        if (service) {
            setFormData(service);
        } else {
            setFormData({ name: '', price: '', description: '', stock: 0, image: '', isActive: true, appliedFields: [] });
        }
    }, [service, show]);

    const openUploadWidget = () => {
        if (!window.cloudinary) { Swal.fire('Lỗi', 'Thư viện upload chưa tải xong!', 'error'); return; }
        window.cloudinary.openUploadWidget({
            cloudName: "dp8zttoxz", 
            uploadPreset: "arenahub_preset",
        }, (error, result) => {
            if (!error && result && result.event === "success") {
                setFormData(prev => ({ ...prev, image: result.info.secure_url }));
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Tải ảnh thành công!', showConfirmButton: false, timer: 1500 });
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUploading(true);

        // Logic tự động: nếu stock = 0 thì isActive = false
        const finalData = { 
            ...formData, 
            isActive: parseInt(formData.stock) > 0 
        };

        try {
            if (service) {
                await axiosClient.put(`/services/${service._id}`, finalData);
                Swal.fire({ icon: 'success', title: 'Cập nhật thành công!', timer: 1500 });
            } else {
                await axiosClient.post('/services', finalData);
                Swal.fire({ icon: 'success', title: 'Thêm mới thành công!', timer: 1500 });
            }
            refreshData();
            handleClose();
        } catch (err) {
            Swal.fire('Lỗi', err.response?.data?.message || 'Có lỗi xảy ra!', 'error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton><Modal.Title>{service ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}</Modal.Title></Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body>
                    {/* Upload ảnh */}
                    <Form.Group className="mb-3 text-center">
                        <Form.Label className="fw-bold w-100">ẢNH DỊCH VỤ</Form.Label>
                        <div className="upload-container mb-3" onClick={openUploadWidget}
                             style={{ border: '2px dashed #ccc', padding: '20px', cursor: 'pointer', borderRadius: '10px' }}>
                            {formData.image ? (
                                <img src={formData.image} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                            ) : (
                                <><CloudUpload size={40} className="text-success" /><p>Click để chọn ảnh</p></>
                            )}
                        </div>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Control required placeholder="Tên dịch vụ" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </Form.Group>

                    {/* Chọn sân áp dụng (Checkbox cuộn) */}
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Chọn sân áp dụng:</Form.Label>
                        <div className="p-2 border rounded" style={{ maxHeight: '150px', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
                            {fields.map(field => (
                                <Form.Check
                                    key={field._id}
                                    type="checkbox"
                                    id={`field-${field._id}`}
                                    label={field.fieldName}
                                    checked={(formData.appliedFields || []).includes(field._id)}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setFormData(prev => ({
                                            ...prev,
                                            appliedFields: isChecked
                                                ? [...(prev.appliedFields || []), field._id]
                                                : (prev.appliedFields || []).filter(id => id !== field._id)
                                        }));
                                    }}
                                />
                            ))}
                        </div>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Control required type="number" placeholder="Giá" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Control placeholder="Mô tả" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Control type="number" placeholder="Tồn kho" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose}>Hủy</Button>
                    <Button type="submit" variant="success" disabled={uploading}>
                        {uploading ? <Spinner size="sm" /> : 'Lưu dịch vụ'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

export default AddEditServiceModal;