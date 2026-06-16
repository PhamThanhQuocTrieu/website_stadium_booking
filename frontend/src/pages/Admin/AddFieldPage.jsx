import React, { useState } from 'react';
import { Container, Card, Form, Row, Col, Button, Tabs, Tab, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { CloudUpload, X, Image as ImageIcon, Trash2 } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import '../../styles/admin/addfield.css';

const timeOptions = Array.from({ length: 39 }, (_, index) => {
    const totalMinutes = 5 * 60 + index * 30;
    if (totalMinutes >= 24 * 60) return '24:00';
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});
const startTimeOptions = timeOptions.filter(time => time !== '24:00');

const AddFieldPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fieldName: '', type: 'Bóng đá', address: '', description: '', image: '', gallery: [],
        status: 'Active', isFeatured: false,
        services: [
            { name: 'Wifi miễn phí', isAvailable: false },
            { name: 'Bãi đậu xe', isAvailable: false },
            { name: 'Canteen', isAvailable: false },
            { name: 'Nước uống', isAvailable: false }
        ],
        pricingRules: [
            { ruleName: 'Khung giờ sáng T2-T6', dayType: 'Weekday', startTime: '05:00', endTime: '17:00', price: 200000, isPeakHour: false },
            { ruleName: 'Khung giờ vàng T2-T6', dayType: 'Weekday', startTime: '17:00', endTime: '24:00', price: 250000, isPeakHour: true },
            { ruleName: 'Cuối tuần', dayType: 'Weekend', startTime: '05:00', endTime: '24:00', price: 270000, isPeakHour: true }
        ]
    });

    const openUploadWidget = (isGallery = false) => {
        if (!window.cloudinary) { Swal.fire('Lỗi', 'Thư viện upload chưa tải xong!', 'error'); return; }
        window.cloudinary.openUploadWidget({
            cloudName: "dp8zttoxz", uploadPreset: "arenahub_preset",
        }, (error, result) => {
            if (!error && result && result.event === "success") {
                const url = result.info.secure_url;
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Tải ảnh thành công!', showConfirmButton: false, timer: 1500 });
                setFormData(prev => ({ ...prev, [isGallery ? 'gallery' : 'image']: isGallery ? [...(prev.gallery || []), url] : url }));
            }
        });
    };

    const toggleService = (index) => {
        const newServices = [...formData.services];
        newServices[index].isAvailable = !newServices[index].isAvailable;
        setFormData({ ...formData, services: newServices });
    };

    const addPricingRule = () => setFormData({ ...formData, pricingRules: [...formData.pricingRules, { ruleName: '', dayType: 'Weekday', startTime: '05:00', endTime: '24:00', price: 0, isPeakHour: false }] });
    const removePricingRule = (index) => setFormData({ ...formData, pricingRules: formData.pricingRules.filter((_, i) => i !== index) });
    const updatePricingRule = (index, field, value) => {
        const newRules = [...formData.pricingRules];
        newRules[index][field] = value;
        setFormData({ ...formData, pricingRules: newRules });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const dataToSend = { ...formData, pricingRules: JSON.stringify(formData.pricingRules), gallery: JSON.stringify(formData.gallery || []) };
            await axiosClient.post('/admin/fields', dataToSend);
            Swal.fire('Thành công', 'Đã khởi tạo sân mới!', 'success');
            navigate('/admin/fields');
        } catch (err) { Swal.fire('Lỗi', 'Không thể tạo sân.', 'error'); }
        finally { setLoading(false); }
    };

    return (
        <Container fluid className="p-4 admin-gradient">
            <Card className="shadow-sm border-0 rounded-4">
                <Card.Header className="bg-white border-0 d-flex justify-content-between align-items-center p-4">
                    <h4 className="fw-bold mb-0">Khởi tạo tài nguyên sân mới</h4>
                    <Button variant="link" className="text-dark" onClick={() => navigate('/admin/fields')}><X /></Button>
                </Card.Header>

                <Form onSubmit={handleSubmit}>
                    <Tabs defaultActiveKey="info" className="px-4 mb-4 custom-tabs">
                        <Tab eventKey="info" title="THÔNG TIN CHUNG" className="p-4">
                            <Row>
                                <Col lg={8}>
                                    <Form.Label className="fw-bold">MÔ TẢ CHI TIẾT SÂN BÃI</Form.Label>
                                    <div className="quill-editor-large"><ReactQuill theme="snow" value={formData.description} onChange={v => setFormData({ ...formData, description: v })} /></div>
                                    <Form.Group className="mt-4"><Form.Label className="fw-bold">ĐỊA CHỈ TOÀN DIỆN *</Form.Label><Form.Control placeholder="Nhập địa chỉ..." value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} required /></Form.Group>
                                </Col>
                                <Col lg={4}>
                                    <Form.Label className="fw-bold">ẢNH BÌA ĐẠI DIỆN</Form.Label>
                                    <div className="upload-container mb-3" onClick={() => openUploadWidget(false)} style={{ overflow: 'hidden', padding: 0, cursor: 'pointer' }}>
                                        {formData.image ? <img src={formData.image} alt="Field" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <><CloudUpload size={40} className="text-success mb-2" /><span>Click để tải ảnh</span></>}
                                    </div>
                                    <Form.Group className="mb-3"><Form.Label className="fw-bold">TÊN SÂN BÃI *</Form.Label><Form.Control value={formData.fieldName} onChange={e => setFormData({ ...formData, fieldName: e.target.value })} required /></Form.Group>
                                    <Form.Group className="mb-3"><Form.Label className="fw-bold">PHÂN HỆ THỂ THAO</Form.Label><Form.Select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}><option>Bóng đá</option><option>Pickleball</option><option>Tennis</option><option>Cầu lông</option></Form.Select></Form.Group>
                                    {/* CÔNG TẮC SÂN NỔI BẬT */}
                                    <Form.Check type="switch" label="Thiết lập làm sân nổi bật" className="fw-bold mt-3" checked={formData.isFeatured} onChange={(e) => setFormData({...formData, isFeatured: e.target.checked})} />
                                </Col>
                            </Row>
                        </Tab>

                        <Tab eventKey="gallery" title="HÌNH ẢNH & DỊCH VỤ" className="p-4">
                            <Row>
                                <Col md={8}>
                                    <Form.Label className="fw-bold">BỘ SƯU TẬP ẢNH BỔ TRỢ (GALLERY)</Form.Label>
                                    <div className="d-flex flex-wrap gap-3 mb-4">
                                        {(formData.gallery || []).map((url, index) => (
                                            <div key={index} className="position-relative" style={{ width: '120px', height: '120px' }}>
                                                <img src={url} alt="Gallery" className="w-100 h-100 rounded shadow-sm" style={{ objectFit: 'cover' }} />
                                                <button type="button" className="btn btn-danger btn-sm position-absolute top-0 end-0 p-1" onClick={() => setFormData(prev => ({ ...prev, gallery: prev.gallery.filter((_, i) => i !== index) }))}><Trash2 size={14}/></button>
                                            </div>
                                        ))}
                                        <div className="upload-container m-0" style={{ width: '120px', height: '120px' }} onClick={() => openUploadWidget(true)}>
                                            <ImageIcon size={30} />
                                            <span className="small mt-1">Thêm ảnh</span>
                                        </div>
                                    </div>
                                </Col>
                                <Col md={4}><Form.Label className="fw-bold">TIỆN ÍCH KHU VỰC MIỄN PHÍ</Form.Label>{formData.services.map((s, i) => (<div key={i} className="d-flex justify-content-between align-items-center mb-3 p-2 border-bottom"><span>{s.name}</span><Form.Check type="switch" checked={s.isAvailable} onChange={() => toggleService(i)} /></div>))}</Col>
                            </Row>
                        </Tab>

                        <Tab eventKey="pricing" title="CẤU HÌNH BẢNG GIÁ LINH HOẠT" className="p-4">
                            <div className="d-flex justify-content-between mb-3 align-items-center"><p className="fw-bold text-success mb-0">$ Đơn giá cấu hình giờ linh hoạt</p><Button variant="success" size="sm" onClick={addPricingRule}>+ Thêm khung giờ mới</Button></div>
                            {formData.pricingRules.map((rule, i) => (
                                <Row key={i} className="align-items-center mb-3 p-3 border rounded bg-white shadow-sm" style={{ gap: '15px', marginLeft: 0, marginRight: 0 }}>
                                    <Col style={{ flex: '1 1 200px' }}><Form.Label className="small fw-bold mb-1">TÊN KHUNG GIỜ *</Form.Label><Form.Control size="sm" value={rule.ruleName} onChange={(e) => updatePricingRule(i, 'ruleName', e.target.value)} /></Col>
                                    <Col style={{ flex: '0 0 140px' }}><Form.Label className="small fw-bold mb-1">NGÀY ÁP DỤNG</Form.Label><Form.Select size="sm" value={rule.dayType} onChange={(e) => updatePricingRule(i, 'dayType', e.target.value)}><option value="Weekday">Ngày thường</option><option value="Weekend">Cuối tuần</option></Form.Select></Col>
                                    <Col style={{ flex: '1 1 200px' }}><Form.Label className="small fw-bold mb-1">THỜI GIAN</Form.Label><div className="d-flex align-items-center"><Form.Select size="sm" value={rule.startTime || '05:00'} onChange={(e) => updatePricingRule(i, 'startTime', e.target.value)}>{startTimeOptions.map(time => <option key={time} value={time}>{time}</option>)}</Form.Select><span className="px-2">-</span><Form.Select size="sm" value={rule.endTime || '24:00'} onChange={(e) => updatePricingRule(i, 'endTime', e.target.value)}>{timeOptions.map(time => <option key={time} value={time}>{time}</option>)}</Form.Select></div></Col>
                                    <Col style={{ flex: '0 0 120px' }}><Form.Label className="small fw-bold mb-1">GIÁ (VND/H)</Form.Label><Form.Control size="sm" type="number" value={rule.price} onChange={(e) => updatePricingRule(i, 'price', e.target.value)} /></Col>
                                    <Col style={{ flex: '0 0 80px' }} className="text-center"><Form.Label className="small fw-bold mb-1">HOT</Form.Label><div className="d-flex justify-content-center mt-1"><Form.Check type="checkbox" checked={rule.isPeakHour} onChange={(e) => updatePricingRule(i, 'isPeakHour', e.target.checked)} /></div></Col>
                                    <Col style={{ flex: '0 0 40px' }} className="text-center"><Form.Label className="small fw-bold mb-1">&nbsp;</Form.Label><Button variant="link" className="text-danger p-0" onClick={() => removePricingRule(i)}><Trash2 size={18}/></Button></Col>
                                </Row>
                            ))}
                        </Tab>
                    </Tabs>
                    <div className="p-4 d-flex justify-content-end bg-light border-top rounded-bottom-4"><Button variant="outline-secondary" className="me-3" onClick={() => navigate('/admin/fields')}>Hủy bỏ</Button><Button variant="success" type="submit" className="px-5" disabled={loading}>{loading ? <Spinner size="sm" /> : 'XÁC NHẬN LƯU HỆ THỐNG'}</Button></div>
                </Form>
            </Card>
        </Container>
    );
};

export default AddFieldPage;
