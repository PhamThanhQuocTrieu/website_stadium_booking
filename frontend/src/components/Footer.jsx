import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import '../styles/Footer.css';

const Footer = () => {
  return (
    <footer className="user-footer">
      <Container fluid className="footer-container">
        <Row className="footer-grid">
          <Col lg={3} md={6}>
            <h3 className="footer-brand">ARENAHUB</h3>
            <p className="footer-description">
              Nền tảng đặt sân thể thao trực tuyến, hỗ trợ người dùng tìm sân, đặt lịch và quản lý lịch đặt nhanh chóng.
            </p>
          </Col>

          <Col lg={3} md={6}>
            <h6 className="footer-heading">KHÁM PHÁ</h6>
            <ul className="footer-list">
              <li><Link to="/fields">Tìm sân</Link></li>
              <li><Link to="/fields">Sân bóng đá</Link></li>
              <li><Link to="/fields">Sân cầu lông</Link></li>
              <li><Link to="/fields">Sân tennis</Link></li>
              <li><Link to="/fields">Sân pickleball</Link></li>
            </ul>
          </Col>

          <Col lg={3} md={6}>
            <h6 className="footer-heading">HỖ TRỢ</h6>
            <ul className="footer-list">
              <li><Link to="/support">Hướng dẫn đặt sân</Link></li>
              <li><Link to="/support">Liên hệ</Link></li>
              <li><Link to="/terms">Điều khoản sử dụng</Link></li>
              <li><Link to="/privacy">Chính sách bảo mật</Link></li>
            </ul>
          </Col>

          <Col lg={3} md={6}>
            <h6 className="footer-heading">LIÊN HỆ</h6>
            <ul className="footer-list footer-contact-list">
              <li><span>Hotline:</span> 0389603429</li>
              <li><span>Email:</span> arenahub@gmail.com</li>
              <li><span>Địa chỉ:</span> Trường Đại học Cần Thơ</li>
            </ul>
          </Col>
        </Row>

        <div className="footer-bottom">
          <p>© 2026 ArenaHub. All rights reserved.</p>
          <div className="footer-policy-links">
            <Link to="/terms">Điều khoản sử dụng</Link>
            <span>|</span>
            <Link to="/privacy">Chính sách bảo mật</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
