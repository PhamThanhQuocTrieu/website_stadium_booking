// File: Frontend/src/pages/FieldsPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Form, Button, Badge, Card, InputGroup, Spinner } from 'react-bootstrap';
import { GeoAlt, Search, Funnel, SortDown, SortUp, Image as ImageIcon } from 'react-bootstrap-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import '../styles/FieldsPage.css'; 

const FieldsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const queryParams = new URLSearchParams(location.search);
  const initialSport = queryParams.get('type') || 'Tất cả';
  const initialLocation = queryParams.get('location') || '';
  const headerSearchWord = queryParams.get('search') || ''; 

  const [fieldsData, setFieldsData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [filter, setFilter] = useState({
    search: headerSearchWord || initialLocation,
    sport: initialSport,
    sortPrice: 'none', 
    status: 'Tất cả'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Lấy danh sách sân (Backend đã được cấu hình .populate('pricingRules'))
  const fetchFields = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/fields');
      setFieldsData(res.data);
      setLoading(false);
    } catch (err) {
      console.error("Lỗi lấy danh sách sân:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();

    // Khởi tạo socket lắng nghe thời gian thực
    const socket = io('http://localhost:5000');

    socket.on('field_updated', (data) => {
      console.log('🔄 Đồng bộ danh sách sân Real-time:', data.action);
      fetchFields(); 
    });

    return () => {
      socket.off('field_updated');
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const currentQuery = new URLSearchParams(location.search);
    const newSearch = currentQuery.get('search') || currentQuery.get('location') || '';
    const newSport = currentQuery.get('type') || 'Tất cả';
    
    setFilter(prev => ({
      ...prev,
      search: newSearch,
      sport: newSport
    }));
    setCurrentPage(1); 
  }, [location.search]);

  // 💡 HÀM TRỢ GIÚP: Tìm mức giá cơ bản (Thấp nhất) của một sân từ mảng pricingRules đã bóc tách
  const getMinPrice = (field) => {
    if (!field.pricingRules || field.pricingRules.length === 0) return 0;
    // Tìm các quy tắc giá thuộc ngày thường 'Weekday' để làm giá hiển thị đại diện đại trà
    const weekdayRules = field.pricingRules.filter(r => r.dayType === 'Weekday');
    const rulesToMin = weekdayRules.length > 0 ? weekdayRules : field.pricingRules;
    return Math.min(...rulesToMin.map(r => r.price || 0));
  };

  // Thuật toán lọc nâng cao và sắp xếp động theo mô hình dữ liệu mới
  const filteredFields = useMemo(() => {
    let result = fieldsData.filter(f => {
      const matchSearch = f.fieldName.toLowerCase().includes(filter.search.toLowerCase()) || 
                          f.address.toLowerCase().includes(filter.search.toLowerCase());
      const matchSport = filter.sport === 'Tất cả' || f.type === filter.sport;
      const matchStatus = filter.status === 'Tất cả' || 
                          (filter.status === 'Còn trống' && f.status === 'Active') ||
                          (filter.status === 'Hết sân' && f.status === 'Maintenance');
      return matchSearch && matchSport && matchStatus;
    });

    // 🌟 ĐÃ CẬP NHẬT: Sắp xếp theo hàm bóc tách getMinPrice(field) thay vì mảng tĩnh index [0] cũ
    if (filter.sortPrice === 'asc') {
      result.sort((a, b) => getMinPrice(a) - getMinPrice(b));
    }
    if (filter.sortPrice === 'desc') {
      result.sort((a, b) => getMinPrice(b) - getMinPrice(a));
    }

    return result;
  }, [filter, fieldsData]);

  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredFields.slice(start, start + itemsPerPage);
  }, [filteredFields, currentPage]);

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <Spinner animation="border" variant="success" />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fields-page-v2">
      
      {/* BANNER HERO */}
      <section className="fields-hero-banner shadow-sm">
        <Container className="px-5">
          <div className="py-2">
            <h2 className="fw-bold mb-1 text-white">Hệ thống danh sách sân bãi</h2>
            <p className="mb-0 text-white-50 small">Tìm kiếm và kiểm tra trạng thái sẵn sàng của sân thể thao theo thời gian thực.</p>
          </div>
        </Container>
      </section>

      <Container className="px-5 mt-4">
        <Row className="g-4">
          
          {/* BỘ LỌC SIDEBAR */}
          <Col lg={3}>
            <div className="filter-sidebar bg-white p-4 rounded-4 shadow-sm">
              <div className="d-flex align-items-center mb-4 border-bottom pb-3">
                <Funnel className="text-success me-2" />
                <h5 className="fw-bold mb-0">Bộ lọc nâng cao</h5>
              </div>

              <div className="mb-4">
                <label className="filter-label">MÔN THỂ THAO</label>
                <Form.Select 
                  className="filter-input shadow-none"
                  value={filter.sport}
                  onChange={(e) => { setFilter({...filter, sport: e.target.value}); setCurrentPage(1); }}
                >
                  <option value="Tất cả">Tất cả môn</option>
                  <option value="Bóng đá">⚽ Bóng đá</option>
                  <option value="Cầu lông">🏸 Cầu lông</option>
                  <option value="Pickleball">🏓 Pickleball</option>
                  <option value="Tennis">🎾 Tennis</option>
                </Form.Select>
              </div>

              <div className="mb-4">
                <label className="filter-label">SẮP XẾP GIÁ</label>
                <div className="d-flex gap-2">
                  <Button 
                    variant={filter.sortPrice === 'asc' ? 'success' : 'outline-light'} 
                    className="flex-fill btn-sort shadow-none text-dark"
                    style={{ color: filter.sortPrice === 'asc' ? '#fff' : '#000' }}
                    onClick={() => setFilter({...filter, sortPrice: 'asc'})}
                  >
                    <SortUp /> Thấp - Cao
                  </Button>
                  <Button 
                    variant={filter.sortPrice === 'desc' ? 'success' : 'outline-light'} 
                    className="flex-fill btn-sort shadow-none text-dark"
                    style={{ color: filter.sortPrice === 'desc' ? '#fff' : '#000' }}
                    onClick={() => setFilter({...filter, sortPrice: 'desc'})}
                  >
                    <SortDown /> Cao - Thấp
                  </Button>
                </div>
              </div>

              <div className="mb-4">
                <label className="filter-label">TRẠNG THÁI SÂN</label>
                {['Tất cả', 'Còn trống', 'Hết sân'].map(st => (
                  <Form.Check 
                    key={st} type="radio" label={st} name="status" id={`status-${st}`}
                    checked={filter.status === st}
                    onChange={() => setFilter({...filter, status: st})}
                    className="status-check fw-semibold small mb-2"
                  />
                ))}
              </div>

              <Button 
                variant="dark" className="w-100 rounded-pill py-2 fw-bold"
                onClick={() => {
                    setFilter({search: '', sport: 'Tất cả', sortPrice: 'none', status: 'Tất cả'});
                    navigate('/fields'); 
                }}
              >
                XÓA TẤT CẢ
              </Button>
            </div>
          </Col>

          {/* DANH SÁCH SÂN */}
          <Col lg={9}>
            <div className="search-wrapper mb-4">
              <InputGroup className="search-group shadow-sm bg-white border-0">
                <InputGroup.Text className="bg-transparent border-0 ps-4"><Search className="text-muted" /></InputGroup.Text>
                <Form.Control 
                  placeholder="Tìm tên sân hoặc khu vực..." 
                  className="search-input border-0 shadow-none py-3"
                  value={filter.search}
                  onChange={(e) => { setFilter({...filter, search: e.target.value}); setCurrentPage(1); }}
                />
              </InputGroup>
            </div>

            <Row>
              <AnimatePresence mode='popLayout'>
                {currentItems.length > 0 ? currentItems.map((field) => {
                  const minPrice = getMinPrice(field);
                  return (
                    <Col md={6} xl={4} key={field._id} className="mb-4">
                      <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Card 
                          className={`field-card-v2 border-0 shadow-sm rounded-4 overflow-hidden h-100 bg-white ${field.status !== 'Active' ? 'sold-out' : ''}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => field.status === 'Active' && navigate(`/field-detail/${field._id}`)} 
                        >
                          <div className="card-img-box">
                            {field.image ? (
                                <img src={field.image} alt={field.fieldName} className="w-100 h-100 object-fit-cover" />
                            ) : (
                                <ImageIcon size={40} opacity={0.15} />
                            )}
                            <Badge bg={field.status === 'Active' ? 'success' : 'danger'} className="status-badge shadow-sm">
                              {field.status === 'Active' ? 'Còn trống' : 'Bảo trì'}
                            </Badge>
                          </div>

                          <Card.Body className="p-3 d-flex flex-column">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <h6 className="fw-bold mb-0 text-truncate text-dark" style={{maxWidth: '130px'}}>{field.fieldName}</h6>
                              {/* 🌟 ĐÃ CẬP NHẬT: Hiển thị giá linh hoạt từ hàm getMinPrice tính toán thực tế */}
                              <span className="price-tag text-success fw-bold">
                                  {minPrice > 0 ? `${minPrice.toLocaleString()}đ/h` : 'Liên hệ'}
                              </span>
                            </div>
                            <p className="location-text text-muted small mb-3 text-truncate">
                              <GeoAlt className="text-danger me-1" /> {field.address}
                            </p>
                            
                            <div className="mi-en-phi-label mb-3 text-uppercase fw-bold" style={{color: '#D4AF37', fontSize: '11px'}}>
                              {field.services?.filter(s => s.isAvailable).length > 0 
                                ? field.services.filter(s => s.isAvailable).slice(0,2).map(s => `FREE: ${s.name} `) 
                                : 'DỊCH VỤ CAO CẤP'}
                            </div>
                            
                            <Button 
                              variant="success" 
                              className="w-100 mt-auto fw-bold py-2 rounded-3 shadow-sm"
                              disabled={field.status !== 'Active'}
                              onClick={(e) => {
                                e.stopPropagation(); 
                                navigate(`/field-detail/${field._id}`);
                              }}
                            >
                              {field.status === 'Active' ? 'XEM LỊCH & ĐẶT NGAY' : 'ĐANG BẢO TRÌ'}
                            </Button>
                          </Card.Body>
                        </Card>
                      </motion.div>
                    </Col>
                  );
                }) : (
                    <Col className="text-center py-5">
                        <p className="text-muted">Không tìm thấy tài nguyên sân tập phù hợp với từ khóa.</p>
                    </Col>
                )}
              </AnimatePresence>
            </Row>
          </Col>
        </Row>
      </Container>
    </motion.div>
  );
};

export default FieldsPage;