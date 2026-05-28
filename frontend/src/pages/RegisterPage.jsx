import React, { useState } from 'react';
import { Container, Row, Col, Form, Button, InputGroup, Spinner } from 'react-bootstrap';
import { Eye, EyeSlash, Phone, Envelope, Person, Lock, ShieldCheck, Trophy, Stars, CheckCircleFill, ArrowLeft } from 'react-bootstrap-icons';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import Swal from 'sweetalert2'; // Import thư viện thông báo chuyên nghiệp

const RegisterPage = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // --- XỬ LÝ ĐĂNG KÝ THỦ CÔNG ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Kiểm tra các trường bắt buộc
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.password || !formData.confirmPassword) {
      return Swal.fire({
        icon: 'warning',
        title: 'Thiếu thông tin',
        text: 'Vui lòng điền đầy đủ các trường có dấu sao (*)',
        confirmButtonColor: '#198754'
      });
    }

    // Kiểm tra khớp mật khẩu
    if (formData.password !== formData.confirmPassword) {
      return Swal.fire({
        icon: 'error',
        title: 'Mật khẩu không khớp',
        text: 'Vui lòng kiểm tra lại mật khẩu xác nhận của bạn.',
        confirmButtonColor: '#d33'
      });
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:5000/api/users/register', {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password
      });

      // Thông báo thành công chuyên nghiệp bằng SweetAlert2
      Swal.fire({
        icon: 'success',
        title: ' Đăng ký thành công!',
        text: 'Chào mừng Triệu đã gia nhập ArenaHub. Hãy đăng nhập để bắt đầu trải nghiệm!',
        confirmButtonColor: '#198754',
        confirmButtonText: 'Đến trang Đăng nhập',
        allowOutsideClick: false
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/login'); // Chuyển hướng sau khi nhấn nút
        }
      });

    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.';
      
      Swal.fire({
        icon: 'error',
        title: 'Lỗi đăng ký',
        text: errorMessage,
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  // --- XỬ LÝ GOOGLE AUTH ---
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/users/google-auth', {
        idToken: credentialResponse.credential
      });

      localStorage.setItem('userToken', res.data.token);
      localStorage.setItem('userInfo', JSON.stringify(res.data));

      Swal.fire({
        icon: 'success',
        title: 'Thành công!',
        text: 'Đăng nhập Google thành công.',
        timer: 1500,
        showConfirmButton: false
      });
      
      navigate('/');
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi Google Auth',
        text: 'Xác thực Google thất bại.',
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      style={{ width: '100vw', height: '100vh', backgroundColor: '#ffffff', overflow: 'hidden' }}
    >
      <Container fluid className="p-0" style={{ height: '100vh' }}>
        <Row className="g-0" style={{ height: '100vh' }}>
          
          {/* ================= BÊN TRÁI: THƯƠNG HIỆU ================= */}
          <Col lg={5} className="d-none d-lg-flex flex-column justify-content-between p-5 text-white position-relative" 
               style={{ 
                 background: 'linear-gradient(135deg, #111b24 0%, #1c2e3d 100%)', 
                 height: '100vh',
                 overflow: 'hidden'
               }}>
            
            <Link to="/" className="text-white text-decoration-none d-flex align-items-center mb-4 opacity-75" style={{ zIndex: 1 }}>
              <ArrowLeft className="me-2" /> Quay về Trang chủ
            </Link>

            <div style={{ zIndex: 1 }}>
              <div className="d-flex align-items-center mb-5">
                <div className="d-flex align-items-center justify-content-center rounded-3 me-3" 
                     style={{ width: '52px', height: '52px', background: '#198754', boxShadow: '0 8px 20px rgba(25, 135, 84, 0.3)' }}>
                  <Stars size={28} className="text-white" />
                </div>
                <div>
                  <h1 className="fw-bold mb-0" style={{ fontSize: '2.2rem', letterSpacing: '-0.5px' }}>ArenaHub</h1>
                  <span className="text-success fw-semibold small" style={{ letterSpacing: '1px' }}>SPORTS PLATFORM</span>
                </div>
              </div>

              <h2 className="fw-bold mb-4" style={{ fontSize: '2.4rem', lineHeight: '1.2' }}>
                Bắt đầu trải nghiệm <br />
                <span className="text-success">đặt sân đỉnh cao</span> ngay!
              </h2>

              <div className="mt-5">
                <div className="d-flex align-items-center mb-4">
                  <CheckCircleFill size={22} className="text-success me-3 flex-shrink-0" />
                  <div>
                    <h6 className="fw-bold mb-0">Tìm kiếm thông minh</h6>
                    <p className="text-muted small mb-0">Tìm cụm sân gần bạn nhất theo thời gian thực.</p>
                  </div>
                </div>
                <div className="d-flex align-items-center mb-4">
                  <CheckCircleFill size={22} className="text-success me-3 flex-shrink-0" />
                  <div>
                    <h6 className="fw-bold mb-0">Đặt lịch thần tốc</h6>
                    <p className="text-muted small mb-0">Hoàn tất thủ tục chỉ trong vài giây.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-top border-secondary border-opacity-50" style={{ zIndex: 1 }}>
              <div className="d-flex align-items-center">
                <Trophy size={20} className="text-warning me-2" />
                <span className="small text-light opacity-75">Hệ thống dành riêng cho cộng đồng yêu thể thao.</span>
              </div>
            </div>
          </Col>

          {/* ================= BÊN PHẢI: FORM ĐĂNG KÝ ================= */}
          <Col lg={7} xs={12} className="d-flex align-items-center justify-content-center p-4 p-md-5 bg-white" style={{ height: '100vh', overflowY: 'auto' }}>
            <div style={{ maxWidth: '440px', width: '100%' }}>
              
              <div className="mb-4 text-center text-lg-start">
                <h3 className="fw-bold text-dark mb-1" style={{ fontSize: '1.85rem' }}>Đăng ký tài khoản</h3>
                <p className="text-muted small">Vui lòng nhập đầy đủ thông tin bên dưới để bắt đầu.</p>
              </div>

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-secondary mb-1">Tên đầy đủ <span className="text-danger">*</span></Form.Label>
                  <InputGroup className="border rounded-3 overflow-hidden bg-light" style={{ height: '46px' }}>
                    <InputGroup.Text className="bg-transparent border-0 text-muted pe-2"><Person size={18} /></InputGroup.Text>
                    <Form.Control
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="border-0 bg-transparent ps-1 shadow-none"
                    />
                  </InputGroup>
                </Form.Group>

                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-bold text-secondary mb-1">Số điện thoại</Form.Label>
                      <InputGroup className="border rounded-3 overflow-hidden bg-light" style={{ height: '46px' }}>
                        <InputGroup.Text className="bg-transparent border-0 text-muted pe-2"><Phone size={18} /></InputGroup.Text>
                        <Form.Control
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className="border-0 bg-transparent ps-1 shadow-none"
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-bold text-secondary mb-1">Email <span className="text-danger">*</span></Form.Label>
                      <InputGroup className="border rounded-3 overflow-hidden bg-light" style={{ height: '46px' }}>
                        <InputGroup.Text className="bg-transparent border-0 text-muted pe-2"><Envelope size={18} /></InputGroup.Text>
                        <Form.Control
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className="border-0 bg-transparent ps-1 shadow-none"
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-secondary mb-1">Mật khẩu <span className="text-danger">*</span></Form.Label>
                  <InputGroup className="border rounded-3 overflow-hidden bg-light" style={{ height: '46px' }}>
                    <InputGroup.Text className="bg-transparent border-0 text-muted pe-2"><Lock size={18} /></InputGroup.Text>
                    <Form.Control
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="border-0 bg-transparent ps-1 shadow-none"
                    />
                    <Button variant="link" onClick={() => setShowPassword(!showPassword)} className="text-muted border-0 shadow-none">
                      {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </Button>
                  </InputGroup>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label className="small fw-bold text-secondary mb-1">Xác nhận mật khẩu <span className="text-danger">*</span></Form.Label>
                  <InputGroup className="border rounded-3 overflow-hidden bg-light" style={{ height: '46px' }}>
                    <InputGroup.Text className="bg-transparent border-0 text-muted pe-2"><ShieldCheck size={18} /></InputGroup.Text>
                    <Form.Control
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="border-0 bg-transparent ps-1 shadow-none"
                    />
                    <Button variant="link" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-muted border-0 shadow-none">
                      {showConfirmPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </Button>
                  </InputGroup>
                </Form.Group>

                <Button 
                  type="submit" 
                  variant="success" 
                  disabled={loading}
                  className="w-100 rounded-pill fw-bold mb-4 d-flex align-items-center justify-content-center shadow-sm"
                  style={{ height: '48px', backgroundColor: '#198754' }}
                >
                  {loading ? <Spinner animation="border" size="sm" /> : 'Đăng Ký Ngay'}
                </Button>

                <div className="text-center mb-4">
                  <p className="text-muted small mb-3">Hoặc tiếp tục với</p>
                  <div className="d-flex justify-content-center">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => Swal.fire('Lỗi', 'Đăng nhập Google thất bại', 'error')}
                      theme="outline"
                      shape="pill"
                      width="350"
                    />
                  </div>
                </div>

                <div className="text-center">
                  <span className="text-muted small">Bạn đã có tài khoản? </span>
                  <Link to="/login" className="text-decoration-none fw-bold small text-success">
                    Đăng nhập ngay
                  </Link>
                </div>
              </Form>
            </div>
          </Col>
        </Row>
      </Container>
    </motion.div>
  );
};

export default RegisterPage;