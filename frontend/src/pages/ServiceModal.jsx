import React, { useState, useEffect } from 'react';
import { Modal, Button, Row, Col, Form } from 'react-bootstrap';
import axios from 'axios';
import '../styles/ServiceModal.css';

const ServiceModal = ({ show, onHide, selectedServices, onAddService, onRemoveService }) => {
    const [services, setServices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');

    useEffect(() => {
        axios.get('http://localhost:5000/api/services')
            .then(res => setServices(res.data))
            .catch(err => console.error(err));
    }, []);

    const getQuantity = (serviceId) => {
        const item = selectedServices.find(s => s.serviceId === serviceId);
        return item ? item.quantity : 0;
    };

    const filteredServices = services.filter(service => {
        const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const totalItems = selectedServices.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = selectedServices.reduce((sum, item) => {
        const service = services.find(s => s._id === item.serviceId);
        return sum + (service ? service.price * item.quantity : 0);
    }, 0);

    return (
        <Modal 
            show={show} 
            onHide={onHide} 
            size="xl" 
            centered 
            dialogClassName="service-modal-modern"
        >
            <Modal.Header className="service-modal-header">
                <Modal.Title>Dịch vụ dành cho bạn</Modal.Title>
            </Modal.Header>

            <Modal.Body className="p-0">
                {/* Search Bar */}
                <div className="search-container p-3 border-bottom">
                    <Form.Control
                        type="text"
                        placeholder="Nhập tên sản phẩm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                {/* Categories */}
                <div className="category-tabs p-3 border-bottom">
                    <Button 
                        variant={activeCategory === 'all' ? 'success' : 'light'}
                        className="me-2"
                        onClick={() => setActiveCategory('all')}
                    >
                        Tất cả
                    </Button>
                    <Button 
                        variant={activeCategory === 'sports' ? 'success' : 'light'}
                        className="me-2"
                        onClick={() => setActiveCategory('sports')}
                    >
                        Dụng cụ thể thao
                    </Button>
                    <Button 
                        variant={activeCategory === 'food' ? 'success' : 'light'}
                        onClick={() => setActiveCategory('food')}
                    >
                        Đồ ăn
                    </Button>
                </div>

                {/* Services List */}
                <div className="services-list p-3" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                    <Row>
                        {filteredServices.map(service => {
                            const qty = getQuantity(service._id);
                            return (
                                <Col md={6} lg={4} key={service._id} className="mb-3">
                                    <div className="service-card">
                                        <div className="service-icon">
                                            <img 
                                                src={service.image || '/placeholder-service.png'} 
                                                alt={service.name} 
                                            />
                                        </div>
                                        <div className="service-info">
                                            <div className="service-name">{service.name}</div>
                                            <div className="service-price">
                                                {service.price.toLocaleString()} đ / {service.unit || 'đơn vị'}
                                            </div>
                                        </div>

                                        <div className="quantity-control">
                                            {qty > 0 ? (
                                                <>
                                                    <Button 
                                                        className="qty-btn minus" 
                                                        onClick={() => onRemoveService(service._id)}
                                                    >
                                                        −
                                                    </Button>
                                                    <span className="qty-number">{qty}</span>
                                                    <Button 
                                                        className="qty-btn plus" 
                                                        onClick={() => onAddService(service)}
                                                    >
                                                        +
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button 
                                                    className="add-btn" 
                                                    onClick={() => onAddService(service)}
                                                >
                                                    +
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Col>
                            );
                        })}
                    </Row>
                </div>
            </Modal.Body>

            {/* Bottom Bar */}
            {totalItems > 0 && (
                <div className="service-footer">
                    <div className="footer-content">
                        <div>
                            <span className="total-items">{totalItems} món</span>
                            <span className="total-price">
                                Tổng cộng: <strong>{totalPrice.toLocaleString()} đ</strong>
                            </span>
                        </div>
                        <Button 
                            variant="warning" 
                            className="add-service-btn"
                            onClick={onHide}
                        >
                            Thêm dịch vụ
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default ServiceModal;