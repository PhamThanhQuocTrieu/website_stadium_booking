import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Row, Col, Button, Tabs, Tab, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { CloudUpload, X, Image as ImageIcon, Trash2 } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import Swal from 'sweetalert2';
import '../../styles/admin/addfield.css';

const UpdateFieldPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState(null);

    // 1. Tải dữ liệu sân để cập nhật
    useEffect(() => {
        const fetchField = async () => {
            try {
                const res = await axiosClient.get(`/admin/fields/${id}`);
                setFormData(res.data);
            } catch (err) {
                Swal.fire('Lỗi', 'Không thể tải thông tin sân.', 'error');
                navigate('/admin/fields');
            }
        };
        fetchField();
    }, [id, navigate]);

    const openUploadWidget = (isGallery = false) => {
        if (!window.cloudinary) { Swal.fire('Lỗi', 'Thư viện upload chưa tải xong!', 'error'); return; }
        window.cloudinary.openUploadWidget({
            cloudName: "dp8zttoxz", uploadPreset: "arenahub_preset",
        }, (error, result) => {
            if (!error && result && result.event === "success") {
                const url = result.info.secure_url;
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Tải ảnh thành công!', showConfirmButton: false, timer: 1500 });
                setFormData(prev => ({ 
                    ...prev, 
                    [isGallery ? 'gallery' : 'image']: isGallery ? [...(prev.gallery || []), url] : url 
                }));
            }
        });
    };

    const toggleService = (index) => {
        const newServices = [...formData.services];
        newServices[index].isAvailable = !newServices[index].isAvailable;
        setFormData({ ...formData, services: newServices });
    };

    const addPricingRule = () => setFormData({ ...formData, pricingRules: [...(formData.pricingRules || []), { ruleName: '', dayType: 'Weekday', startTime: '05:00', endTime: '17:00', price: 0, isPeakHour: false }] });
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
            // Hiển thị thông báo chờ
            Swal.fire({ title: 'Đang cập nhật...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            await axiosClient.put(`/admin/fields/${id}`, formData);
            
            // Thông báo thành công
            Swal.fire({
                icon: 'success',
                title: 'Thành công!',
                text: 'Dữ liệu sân đã được cập nhật vào hệ thống.',
                timer: 2000
            });
            navigate('/admin/fields');
        } catch (err) { 
            Swal.fire('Lỗi', 'Cập nhật thất bại. Vui lòng kiểm tra lại dữ liệu!', 'error'); 
        } finally { 
            setLoading(false); 
        }
    };

    if (!formData) return <div className="p-5 text-center"><Spinner animation="border" /></div>;

    return (
        <Container fluid className="p-4 admin-gradient">
            <Card className="shadow-sm border-0 rounded-4">
                <Card.Header className="bg-white border-0 d-flex justify-content-between align-items-center p-4">
                    <h4 className="fw-bold mb-0">Cập nhật tài nguyên sân</h4>
                    <Button variant="link" className="text-dark" onClick={() => navigate('/admin/fields')}><X /></Button>
                </Card.Header>

                <Form onSubmit={handleSubmit}>
                    <Tabs defaultActiveKey="info" className="px-4 mb-4 custom-tabs">
                        <Tab eventKey="info" title="THÔNG TIN CHUNG" className="p-4">
                            <Row>
                                <Col lg={8}>
                                    <Form.Label className="fw-bold">MÔ TẢ CHI TIẾT SÂN BÃI</Form.Label>
                                    <div className="quill-editor-large"><ReactQuill theme="snow" value={formData.description || ''} onChange={v => setFormData({ ...formData, description: v })} /></div>
                                    <Form.Group className="mt-4"><Form.Label className="fw-bold">ĐỊA CHỈ TOÀN DIỆN *</Form.Label><Form.Control value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} required /></Form.Group>
                                </Col>
                                <Col lg={4}>
                                    <Form.Label className="fw-bold">ẢNH BÌA ĐẠI DIỆN</Form.Label>
                                    <div className="upload-container mb-3" onClick={() => openUploadWidget(false)} style={{ overflow: 'hidden', padding: 0, cursor: 'pointer' }}>
                                        {formData.image ? <img src={formData.image} alt="Field" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <><CloudUpload size={40} className="text-success mb-2" /><span>Click tải ảnh bìa</span></>}
                                    </div>
                                    <Form.Group className="mb-3"><Form.Label className="fw-bold">TÊN SÂN BÃI *</Form.Label><Form.Control value={formData.fieldName || ''} onChange={e => setFormData({ ...formData, fieldName: e.target.value })} required /></Form.Group>
                                    <Form.Group className="mb-3"><Form.Label className="fw-bold">PHÂN HỆ THỂ THAO</Form.Label><Form.Select value={formData.type || 'Bóng đá'} onChange={e => setFormData({ ...formData, type: e.target.value })}><option>Bóng đá</option><option>Pickleball</option><option>Tennis</option><option>Cầu lông</option></Form.Select></Form.Group>
                                    <Form.Check type="switch" label="Thiết lập làm sân nổi bật" className="fw-bold mt-3" checked={!!formData.isFeatured} onChange={(e) => setFormData({...formData, isFeatured: e.target.checked})} />
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
                                <Col md={4}><Form.Label className="fw-bold">TIỆN ÍCH KHU VỰC MIỄN PHÍ</Form.Label>{(formData.services || []).map((s, i) => (<div key={i} className="d-flex justify-content-between align-items-center mb-3 p-2 border-bottom"><span>{s.name}</span><Form.Check type="switch" checked={s.isAvailable} onChange={() => toggleService(i)} /></div>))}</Col>
                            </Row>
                        </Tab>

                        <Tab eventKey="pricing" title="CẤU HÌNH BẢNG GIÁ LINH HOẠT" className="p-4">
                            <div className="d-flex justify-content-between mb-3 align-items-center"><Button variant="success" size="sm" onClick={addPricingRule}>+ Thêm khung giờ mới</Button></div>
                            {(formData.pricingRules || []).map((rule, i) => (
                                <Row key={i} className="align-items-center mb-3 p-3 border rounded bg-white shadow-sm" style={{ gap: '15px', marginLeft: 0, marginRight: 0 }}>
                                    <Col style={{ flex: '1 1 200px' }}><Form.Label className="small fw-bold mb-1">TÊN KHUNG GIỜ *</Form.Label><Form.Control size="sm" value={rule.ruleName || ''} onChange={(e) => updatePricingRule(i, 'ruleName', e.target.value)} /></Col>
                                    <Col style={{ flex: '0 0 140px' }}><Form.Label className="small fw-bold mb-1">NGÀY ÁP DỤNG</Form.Label><Form.Select size="sm" value={rule.dayType || 'Weekday'} onChange={(e) => updatePricingRule(i, 'dayType', e.target.value)}><option value="Weekday">Ngày thường</option><option value="Weekend">Cuối tuần</option></Form.Select></Col>
                                    <Col style={{ flex: '1 1 200px' }}><Form.Label className="small fw-bold mb-1">THỜI GIAN</Form.Label><div className="d-flex align-items-center"><Form.Control size="sm" type="time" value={rule.startTime || ''} onChange={(e) => updatePricingRule(i, 'startTime', e.target.value)} /> — <Form.Control size="sm" type="time" value={rule.endTime || ''} onChange={(e) => updatePricingRule(i, 'endTime', e.target.value)} /></div></Col>
                                    <Col style={{ flex: '0 0 120px' }}><Form.Label className="small fw-bold mb-1">GIÁ (VND/H)</Form.Label><Form.Control size="sm" type="number" value={rule.price || 0} onChange={(e) => updatePricingRule(i, 'price', e.target.value)} /></Col>
                                    <Col style={{ flex: '0 0 40px' }} className="text-center"><Button variant="link" className="text-danger p-0" onClick={() => removePricingRule(i)}><Trash2 size={18}/></Button></Col>
                                </Row>
                            ))}
                        </Tab>
                    </Tabs>
                    <div className="p-4 d-flex justify-content-end bg-light border-top rounded-bottom-4"><Button variant="success" type="submit" className="px-5">LƯU THAY ĐỔI</Button></div>
                </Form>
            </Card>
        </Container>
    );
};

export default UpdateFieldPage;