// File: Frontend/src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Form, Badge, Carousel, Card, Spinner } from 'react-bootstrap';
import { ArrowRight } from 'react-bootstrap-icons';
import { useNavigate } from 'react-router-dom'; 
import axios from 'axios';
import AOS from 'aos'; 
import 'aos/dist/aos.css';
import { io } from 'socket.io-client';
import '../styles/HomePage.css'; 

// Import các tài nguyên biểu ngữ hệ thống ArenaHub
import banner1 from '../assets/banner1.png';
import banner2 from '../assets/banner2.png';
import banner3 from '../assets/banner1.png'; 
import banner4 from '../assets/banner2.png';

const HomePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allFields, setAllFields] = useState([]); 
  
  // State quản trị dữ liệu cho thanh tìm kiếm đa năng
  const [searchParams, setSearchParams] = useState({
    location: '',
    type: 'Tất cả',
    dateTime: ''
  });

  // Lấy dữ liệu tài nguyên phân hệ từ API
  const fetchData = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/fields');
      setAllFields(res.data);
      setLoading(false);
    } catch (err) {
      console.error("Lỗi lấy dữ liệu sân:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); // Gọi hàm khởi tạo dữ liệu lần đầu tiên khi truy cập trang
    AOS.init({ duration: 1000, once: true });

    // ⚡ KHỞI TẠO CỔNG SOCKET THỜI GIAN THỰC AN TOÀN TRONG VÒNG ĐỜI COMPONENT
    const socket = io('http://localhost:5000');

    console.log("⚡ Đã kích hoạt lắng nghe biến động tài nguyên Real-time ArenaHub...");

    // LẮNG NGHE REAL-TIME: Tự động cập nhật giao diện khi Admin thêm, sửa hoặc xóa sân bãi
    socket.on('field_updated', (data) => {
      console.log('🔄 [Socket.io] Phát hiện database có sự thay đổi từ Admin:', data?.message);
      fetchData(); 
    });

    socket.on('slot_booked_success', () => {
      fetchData();
    });

    return () => {
      socket.off('field_updated');
      socket.off('slot_booked_success');
      socket.disconnect(); 
    };
  }, []);

  // HÀM TRỢ GIÚP: Tìm mức giá cơ bản thấp nhất từ mảng pricingRules đã bóc tách để render ra màn hình
  const getMinPrice = (field) => {
    if (!field.pricingRules || field.pricingRules.length === 0) return 0;
    const weekdayRules = field.pricingRules.filter(r => r.dayType === 'Weekday');
    const rulesToMin = weekdayRules.length > 0 ? weekdayRules : field.pricingRules;
    return Math.min(...rulesToMin.map(r => r.price || 0));
  };

  // PHÂN TÁCH DANH MỤC CÁC PHÂN HỆ SÂN
  const featuredFields = allFields.filter(f => f.isFeatured === true);
  const footballFields = allFields.filter(f => f.type === 'Bóng đá').slice(0, 4);
  const badmintonFields = allFields.filter(f => f.type === 'Cầu lông').slice(0, 4);
  const pickleballFields = allFields.filter(f => f.type === 'Pickleball').slice(0, 4);
  const tennisFields = allFields.filter(f => f.type === 'Tennis').slice(0, 4); 

  // Điều hướng tìm kiếm nâng cao sang tệp danh mục FieldsPage kèm Query Params
  const handleSearch = () => {
    const query = new URLSearchParams(searchParams).toString();
    navigate(`/fields?${query}`);
  };

  // Thành phần Card hiển thị chi tiết tài nguyên sân
  const FieldCard = ({ field }) => {
    const minPrice = getMinPrice(field);
    return (
      <Col md={3} className="mb-4" data-aos="zoom-in">
        <Card className="field-card border-0 shadow-sm rounded-4 overflow-hidden h-100 bg-white">
          <div style={{ height: '180px', position: 'relative' }}>
            <Card.Img 
              variant="top"
              src={field.image || 'https://via.placeholder.com/300x180?text=ArenaHub+Sport'} 
              className="w-100 h-100" 
              style={{ objectFit: 'cover' }} 
              alt={field.fieldName}
            />
            {field.isFeatured && (
              <Badge bg="warning" className="position-absolute top-0 end-0 m-2 text-dark shadow-sm fw-bold">
                ★ Nổi bật
              </Badge>
            )}
          </div>
          <Card.Body className="p-3 d-flex flex-column">
            <h5 className="fw-bold mb-1 text-dark text-truncate" style={{ fontSize: '1.05rem' }}>{field.fieldName}</h5>
            <small className="text-muted mb-3 d-block text-truncate">📍 {field.address}</small>
            
            <div className="mt-auto d-flex justify-content-between align-items-center pt-2 border-top">
              <div>
                <small className="text-muted d-block" style={{ fontSize: '0.65rem', fontWeight: 700 }}>GIÁ TỪ</small>
                <span className="text-success fw-bold fs-5">
                  {minPrice > 0 ? `${minPrice.toLocaleString()}đ/h` : '150.000đ'}
                </span>
              </div>
              <Button 
                variant="success" 
                size="sm" 
                className="fw-bold px-3 rounded-pill btn-details-premium" 
                // 🌟 ĐÃ SỬA: Chuyển hướng chuẩn xác về trang chi tiết sản phẩm/sân bóng thay vì nhảy thẳng vào đặt sân
                onClick={() => navigate(`/field-detail/${field._id}`)} 
              >
                CHI TIẾT
              </Button>
            </div>
          </Card.Body>
        </Card>
      </Col>
    );
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="text-center">
        <Spinner animation="border" variant="success" className="mb-2" />
        <h6 className="text-muted fw-bold">Đang đồng bộ phân hệ tài nguyên ArenaHub...</h6>
      </div>
    </div>
  );

  return (
    <div className="homepage-container">
      {/* 1. BANNER CHẠY CAROUSEL HERO */}
      <section className="banner-top-section position-relative">
        <Carousel indicators={true} interval={4000} fade pause={false}>
          {[banner1, banner2, banner3, banner4].map((imgSrc, idx) => (
            <Carousel.Item key={idx}>
              <div className="banner-container">
                <img src={imgSrc} alt="ArenaHub Promo Banner" className="banner-img" />
              </div>
            </Carousel.Item>
          ))}
        </Carousel>

        {/* 2. THANH TÌM KIẾM ĐA CHỨC NĂNG */}
        <div className="search-overlay-container">
          <Container fluid className="px-5">
            <div className="search-bar-box shadow-lg bg-white p-4 rounded-4">
              <Row className="g-3 align-items-end">
                <Col md={4}>
                  <Form.Label className="fw-bold small text-secondary">Địa điểm khu vực</Form.Label>
                  <Form.Control 
                    placeholder="Nhập quận Ninh Kiều, Cái Răng hoặc tên đường..." 
                    value={searchParams.location}
                    onChange={(e) => setSearchParams({...searchParams, location: e.target.value})}
                  />
                </Col>
                <Col md={3}>
                  <Form.Label className="fw-bold small text-secondary">Loại hình thể thao</Form.Label>
                  <Form.Select 
                    value={searchParams.type}
                    onChange={(e) => setSearchParams({...searchParams, type: e.target.value})}
                  >
                    <option value="Tất cả">Tất cả bộ môn</option>
                    <option value="Bóng đá">⚽ Bóng đá</option>
                    <option value="Cầu lông">🏸 Cầu lông</option>
                    <option value="Pickleball">🏓 Pickleball</option>
                    <option value="Tennis">🎾 Tennis</option>
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Label className="fw-bold small text-secondary">Ngày & Giờ đặt sân</Form.Label>
                  <Form.Control 
                    type="datetime-local" 
                    value={searchParams.dateTime}
                    onChange={(e) => setSearchParams({...searchParams, dateTime: e.target.value})}
                  />
                </Col>
                <Col md={2}>
                  <Button variant="success" className="w-100 py-2 fw-bold shadow-sm text-uppercase" onClick={handleSearch}>
                    Tìm sân ngay
                  </Button>
                </Col>
              </Row>
            </div>
          </Container>
        </div>
      </section>

      {/* KHỐI HIỂN THỊ DANH MỤC CÁC PHÂN HỆ SÂN BÃI TRỰC TUYẾN */}
      <Container fluid className="px-5" style={{ marginTop: '90px', paddingBottom: '50px' }}>
        
        {/* 3. DANH MỤC SÂN NỔI BẬT */}
        {featuredFields.length > 0 && (
          <div className="my-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <span className="text-danger fw-bold small text-uppercase" style={{ letterSpacing: '1px' }}>— TOP CHOICE</span>
                <h2 className="fw-bold text-dark mt-1">Sân nổi bật hệ thống</h2>
              </div>
              <Button variant="link" className="text-success fw-bold text-decoration-none" onClick={() => navigate('/fields')}>
                XEM TẤT CẢ <ArrowRight />
              </Button>
            </div>
            <Row>
              {featuredFields.slice(0, 4).map(field => <FieldCard key={field._id} field={field} />)}
            </Row>
          </div>
        )}

        {/* 4. DANH SÁCH TÀI NGUYÊN PHÂN CHIA THEO TỪNG BỘ MÔN */}
        {[
          { title: 'Sân bóng đá', data: footballFields },
          { title: 'Sân cầu lông', data: badmintonFields },
          { title: 'Sân Tennis đỉnh cao', data: tennisFields }, 
          { title: 'Sân Pickleball', data: pickleballFields }
        ].map((section, idx) => (
          section.data.length > 0 && (
            <div className="my-5" key={idx} data-aos="fade-up">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h3 className="fw-bold mb-0 border-start border-4 border-success ps-3 text-dark">{section.title}</h3>
                <Button variant="link" className="text-success fw-bold text-decoration-none small" onClick={() => navigate(`/fields?type=${section.title.includes('Bóng') ? 'Bóng đá' : section.title.includes('Cầu') ? 'Cầu lông' : section.title.includes('Tennis') ? 'Tennis' : 'Pickleball'}`)}>
                  Xem thêm
                </Button>
              </div>
              <Row>
                {section.data.map(field => <FieldCard key={field._id} field={field} />)}
              </Row>
            </div>
          )
        ))}
      </Container>
    </div>
  );
};

export default HomePage;