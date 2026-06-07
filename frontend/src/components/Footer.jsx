import React from 'react';
import { Container, Row, Col, Form, Button } from 'react-bootstrap';
import '../styles/Footer.css';

const Footer = () => {
  return (
    <footer style={{ backgroundColor: '#111827', color: '#9ca3af' }} className="py-5 mt-5 user-footer">
      <Container fluid className="footer-container">
        <Row className="g-4">
          {/* Cột 1: Thông tin thương hiệu */}
          <Col md={3}>
            <h3 className="text-white fw-bold">ArenaHub</h3>
            <p className="small mt-3">Nền tảng đặt sân thể thao trực tuyến hàng đầu. Kết nối người chơi với hàng nghìn sân tốt nhất trên cả nước.</p>
          </Col>

          {/* Cột 2: Khám phá */}
          <Col md={2}>
            <h6 className="text-white fw-bold mb-3">KHÁM PHÁ</h6>
            <ul className="list-unstyled small">
              <li className="mb-2">Tìm sân</li>
              <li className="mb-2">Bản đồ</li>
              <li className="mb-2">Sân bóng đá</li>
              <li className="mb-2">Sân cầu lông</li>
            </ul>
          </Col>

          {/* Cột 3: Hỗ trợ */}
          <Col md={2}>
            <h6 className="text-white fw-bold mb-3">HỖ TRỢ</h6>
            <ul className="list-unstyled small">
              <li className="mb-2">Hướng dẫn đặt sân</li>
              <li className="mb-2">Liên hệ</li>
              <li className="mb-2">Chính sách hoàn tiền</li>
            </ul>
          </Col>

          {/* Cột 4: Đăng ký nhận ưu đãi */}
          <Col md={5}>
            <h6 className="text-white fw-bold mb-3">ĐĂNG KÝ NHẬN ƯU ĐÃI</h6>
            <p className="small">Nhận ngay voucher giảm 20% cho lần đặt sân đầu tiên</p>
            <div className="footer-subscribe d-flex mb-3">
              <Form.Control type="email" placeholder="Email của bạn" className="rounded-0" />
              <Button variant="success" className="rounded-0">Đăng ký</Button>
            </div>
            <p className="text-white">Hotline hỗ trợ 24/7: <span className="text-success fw-bold">0389603429</span></p>
          </Col>
        </Row>
        
        <hr className="my-4 border-secondary" />
        
        <Row className="small footer-bottom">
          <Col>© 2026 ArenaHub - All rights reserved.</Col>
          <Col className="text-end">Đăng ký chủ sân? <a href="#" className="text-success">Liên hệ ngay</a></Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;
