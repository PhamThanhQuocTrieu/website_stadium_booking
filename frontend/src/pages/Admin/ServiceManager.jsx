import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Row, Col, Badge, Form, InputGroup, Spinner, Modal, Pagination } from 'react-bootstrap';
import { Plus, Search, Trash2, Edit3, Package, TrendingUp, CheckCircle, XCircle, Inbox, CloudUpload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient'; 
import Swal from 'sweetalert2';
import { io } from 'socket.io-client';
import '../../styles/admin/servicemanager.css';

const socket = io('http://localhost:5000');

const serviceTypeLabel = {
    rental: 'Cho thuê',
    consumable: 'Tiêu hao'
};

const ServiceManager = () => {
    const [services, setServices] = useState([]);
    const [fields, setFields] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 7;

    const emptyForm = { name: '', price: '', description: '', stock: 0, image: '', inventoryType: 'rental', isActive: true, appliedFields: [] };
    const [formData, setFormData] = useState(emptyForm);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        loadData();
        loadFields();
        socket.on('serviceCreated', loadData);
        socket.on('serviceUpdated', loadData);
        socket.on('serviceDeleted', loadData);
        return () => { socket.off(); };
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data } = await axiosClient.get('/services');
            setServices(Array.isArray(data) ? data : (data.services || []));
        } finally { setLoading(false); }
    };

    const loadFields = async () => {
        try {
            const { data } = await axiosClient.get('/fields');
            setFields(data);
        } catch (err) { console.error("Không thể tải danh sách sân"); }
    };

    const filtered = services.filter(s => (s.name.toLowerCase().includes(search.toLowerCase())) && (filter === 'all' || (filter === 'active' ? s.isActive : !s.isActive)));
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

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

    const handleOpenModal = (service = null) => {
        setEditingService(service);
        setFormData(service ? { ...emptyForm, ...service, inventoryType: service.inventoryType || 'rental' } : emptyForm);
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUploading(true);
        const finalData = { ...formData, stock: Number(formData.stock || 0), price: Number(formData.price || 0) };

        try {
            if (editingService) {
                await axiosClient.put(`/services/${editingService._id}`, finalData);
                Swal.fire('Thành công', 'Đã cập nhật dịch vụ', 'success');
            } else {
                await axiosClient.post('/services', finalData);
                Swal.fire('Thành công', 'Đã thêm dịch vụ', 'success');
            }
            setShowModal(false);
            loadData();
        } catch (err) { Swal.fire('Lỗi', err.response?.data?.message || 'Có lỗi xảy ra', 'error'); }
        finally { setUploading(false); }
    };

    const handleDelete = (service) => {
        Swal.fire({
            title: 'Xóa dịch vụ?',
            html: `<img src="${service.image}" style="width:100px; height:100px; border-radius:10px; object-fit:cover; margin-bottom:10px;"/>
                   <p>Bạn có chắc muốn xóa <b>${service.name}</b>?</p>`,
            showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Xóa'
        }).then(async (result) => {
            if (result.isConfirmed) {
                await axiosClient.delete(`/services/${service._id}`);
                loadData();
            }
        });
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="service-manager-page p-4" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
            <div className="admin-page-heading">
                <div>
                    <span>ARENAHUB ADMIN</span>
                    <h1>Quản lý dịch vụ đi kèm</h1>
                    <p>Quản lý tiện ích, đồ uống và vật phẩm hỗ trợ khách hàng trong quá trình đặt sân.</p>
                </div>
            </div>
            {/* Toolbar giữ nguyên ... */}
            <Row className="mb-4 g-3">
                {[
                    { t: 'Tổng dịch vụ', v: services.length, i: <Package />, c: '#0d6efd' },
                    { t: 'Đang hoạt động', v: services.filter(s=>s.isActive).length, i: <CheckCircle />, c: '#198754' },
                    { t: 'Ngưng hoạt động', v: services.filter(s=>!s.isActive).length, i: <XCircle />, c: '#dc3545' },
                    { t: 'Tổng tồn kho', v: services.reduce((a,b) => a + b.stock, 0), i: <TrendingUp />, c: '#ffc107' }
                ].map((s, i) => (
                    <Col md={3} key={i}>
                        <Card className="shadow-sm border-0 h-100 p-3"><div className="d-flex justify-content-between align-items-center"><div><small className="text-muted">{s.t}</small><h4 className="m-0">{s.v}</h4></div><div style={{ color: s.c }}>{s.i}</div></div></Card>
                    </Col>
                ))}
            </Row>

            <div className="service-manager-toolbar d-flex gap-2 mb-4 bg-white p-2 rounded shadow-sm align-items-center">
                <InputGroup className="flex-grow-1 border-0">
                    <InputGroup.Text className="bg-transparent border-0"><Search size={18} /></InputGroup.Text>
                    <Form.Control className="border-0 shadow-none" placeholder="Tìm tên dịch vụ, mô tả..." onChange={(e) => {setSearch(e.target.value); setCurrentPage(1);}} />
                </InputGroup>
                <div className="service-manager-divider vr mx-1" />
                <Form.Select className="service-manager-filter border-0 shadow-none" onChange={(e) => {setFilter(e.target.value); setCurrentPage(1);}}>
                    <option value="all">Tất cả</option><option value="active">Hoạt động</option><option value="inactive">Ngưng</option>
                </Form.Select>
                <Button variant="success" className="px-3" onClick={() => handleOpenModal()}><Plus size={20}/> Thêm mới</Button>
            </div>

            <Card className="shadow-sm border-0">
                <Card.Body className="p-0">
                    {loading ? <div className="text-center py-5"><Spinner animation="border" variant="primary"/></div> : 
                     filtered.length === 0 ? <div className="text-center py-5"><Inbox size={40} className="text-muted"/> <p>Không tìm thấy dịch vụ!</p></div> :
                    <>
                        <Table hover responsive className="align-middle mb-0">
                            <thead className="bg-light"><tr><th className="ps-4">Ảnh</th><th>Tên dịch vụ</th><th>Loại</th><th>Giá</th><th>Tồn kho</th><th>Trạng thái</th><th className="text-end pe-4">Thao tác</th></tr></thead>
                            <tbody>
                                <AnimatePresence>
                                    {currentItems.map(s => (
                                        <motion.tr key={s._id} initial={{opacity:0}} animate={{opacity:1}}>
                                            <td className="ps-4"><img src={s.image} className="rounded" style={{width:45, height:45, objectFit:'cover'}} alt="thumb"/></td>
                                            <td className="fw-semibold">{s.name}</td>
                                            <td><Badge bg={s.inventoryType === 'consumable' ? 'warning' : 'info'}>{serviceTypeLabel[s.inventoryType || 'rental']}</Badge></td>
                                            <td>{Number(s.price).toLocaleString()}đ</td>
                                            <td>{s.stock}</td>
                                            <td><Badge bg={s.isActive ? 'success' : 'danger'}>{s.isActive ? 'Active' : 'Inactive'}</Badge></td>
                                            <td className="text-end pe-4">
                                                <Button variant="light" size="sm" className="me-2" onClick={() => handleOpenModal(s)}><Edit3 size={16}/></Button>
                                                <Button variant="light" size="sm" className="text-danger" onClick={() => handleDelete(s)}><Trash2 size={16}/></Button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </Table>
                        <div className="p-3 border-top d-flex justify-content-center">
                            <Pagination>
                                <Pagination.Prev disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} />
                                {[...Array(totalPages)].map((_, i) => (
                                    <Pagination.Item key={i + 1} active={i + 1 === currentPage} onClick={() => setCurrentPage(i + 1)}>{i + 1}</Pagination.Item>
                                ))}
                                <Pagination.Next disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} />
                            </Pagination>
                        </div>
                    </>}
                </Card.Body>
            </Card>

            <Modal show={showModal} onHide={() => setShowModal(false)} centered>
                <Modal.Header closeButton><Modal.Title>{editingService ? 'Cập nhật' : 'Thêm'} Dịch vụ</Modal.Title></Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleSubmit}>
                        <div className="text-center mb-3 p-3 border rounded" onClick={openUploadWidget} style={{ cursor: 'pointer', borderStyle: 'dashed', border: '2px dashed #ccc' }}>
                            {formData.image ? <img src={formData.image} style={{width:100, height:100, objectFit:'cover', borderRadius:8}}/> : <CloudUpload size={40} className="text-muted"/>}
                            <p className="mt-2 mb-0">Nhấp để chọn ảnh</p>
                        </div>
                        <Form.Group className="mb-3"><Form.Control placeholder="Tên dịch vụ" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Control placeholder="Mô tả" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Loại tồn kho</Form.Label>
                            <Form.Select value={formData.inventoryType || 'rental'} onChange={e => setFormData({...formData, inventoryType: e.target.value})}>
                                <option value="rental">Cho thuê - khách trả lại sau giờ chơi</option>
                                <option value="consumable">Tiêu hao - dùng xong là hết</option>
                            </Form.Select>
                        </Form.Group>
                        
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Chọn sân áp dụng:</Form.Label>
                            <div className="p-2 border rounded" style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #dee2e6' }}>
                                {/* Checkbox Tất cả */}
                                <Form.Check
                                    type="checkbox"
                                    label="Chọn tất cả các sân"
                                    className="fw-bold border-bottom pb-2 mb-2"
                                    checked={formData.appliedFields.length === fields.length && fields.length > 0}
                                    onChange={(e) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            appliedFields: e.target.checked ? fields.map(f => f._id) : []
                                        }));
                                    }}
                                />
                                {fields.map(field => (
                                    <Form.Check
                                        key={field._id}
                                        type="checkbox"
                                        label={field.fieldName}
                                        checked={formData.appliedFields.includes(field._id)}
                                        onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            setFormData(prev => ({
                                                ...prev,
                                                appliedFields: isChecked
                                                    ? [...prev.appliedFields, field._id]
                                                    : prev.appliedFields.filter(id => id !== field._id)
                                            }));
                                        }}
                                    />
                                ))}
                            </div>
                        </Form.Group>

                        <Form.Group className="mb-3"><Form.Control type="number" placeholder="Giá" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Control type="number" placeholder="Tồn kho" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} /></Form.Group>
                        <Button type="submit" className="w-100" disabled={uploading}>{uploading ? <Spinner size="sm" /> : 'Lưu dịch vụ'}</Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </motion.div>
    );
};

export default ServiceManager;
