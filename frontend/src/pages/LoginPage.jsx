import React, { useState } from 'react';
import { Container, Row, Col, Form, Button, InputGroup, Spinner } from 'react-bootstrap';
import { Eye, EyeSlash, Person, Lock, Stars, Trophy, ArrowLeft, LightningCharge, ShieldCheck, Clock } from 'react-bootstrap-icons';
import { Link, useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import Swal from 'sweetalert2';
import '../styles/LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ account: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const saveAuthData = (data) => {
    if (data && data.token) {
      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userInfo', JSON.stringify(data));
      window.dispatchEvent(new Event('authChanged'));
      return true;
    }
    return false;
  };

  const handleLoginSuccess = (data) => {
    if (saveAuthData(data)) {
      const role = String(data.role || '').toLowerCase();
      const isAdmin = role === 'admin' || role === 'super admin';
      Swal.fire({
        icon: 'success',
        title: 'Đăng nhập thành công!',
        text: isAdmin ? 'Chào Quản trị viên...' : `Chào mừng ${data.fullName}...`,
        timer: 1500,
        showConfirmButton: false
      });

      setTimeout(() => navigate(isAdmin ? '/admin' : '/'), 1500);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.account.trim() || !formData.password) {
      return Swal.fire({
        icon: 'warning',
        title: 'Thiếu thông tin',
        text: 'Vui lòng nhập Email và Mật khẩu.',
        confirmButtonColor: '#198754'
      });
    }

    setLoading(true);
    try {
      const { data } = await axios.post('http://localhost:5000/api/users/login', {
        account: formData.account.trim().toLowerCase(),
        password: formData.password
      });
      handleLoginSuccess(data);
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: err.response?.data?.message || 'Đăng nhập thất bại.',
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const { data } = await axios.post('http://localhost:5000/api/users/google-login', {
        token: credentialResponse.credential
      });
      handleLoginSuccess(data);
    } catch {
      Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Xác thực Google thất bại.', confirmButtonColor: '#d33' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
      <Container fluid className="auth-page p-0">
        <Row className="auth-shell g-0">
          <Col lg={5} className="auth-brand-panel d-none d-lg-flex">
            <Link to="/" className="auth-back-link">
              <ArrowLeft className="me-2" /> Quay về Trang chủ
            </Link>

            <div className="auth-brand-main">
              <div className="auth-logo-row">
                <div className="auth-logo-box"><Stars size={30} /></div>
                <div>
                  <div className="auth-brand-name">ARENA<span>HUB</span></div>
                  <p>Kết nối đam mê - Bứt phá giới hạn</p>
                </div>
              </div>

              <div className="auth-hero-copy">
                <h1>Sẵn sàng cho <span>trận đấu</span> tiếp theo?</h1>
                <p>Đăng nhập để quản lý lịch đặt sân, theo dõi thanh toán và khám phá những khung giờ đẹp nhất trên ArenaHub.</p>
              </div>

              <div className="auth-mini-stats">
                <div><LightningCharge /><strong>24/7</strong><span>Đặt sân nhanh mọi lúc</span></div>
                <div><ShieldCheck /><strong>An toàn</strong><span>Thanh toán bảo mật</span></div>
                <div><Clock /><strong>Tiết kiệm</strong><span>Giữ chỗ tự động 3 phút</span></div>
              </div>
            </div>

            <div className="auth-brand-footer">
              <Trophy className="text-warning me-2" /> Tham gia ngay cộng đồng thể thao ArenaHub.
              <span>Hơn 10.000+ thành viên đã đồng hành cùng chúng tôi.</span>
            </div>
          </Col>

          <Col lg={7} className="auth-form-panel">
            <div className="auth-card auth-card-login">
              <div className="auth-form-heading text-center">
                <h3>Đăng nhập</h3>
                <p>Chào mừng bạn trở lại <strong>ArenaHub</strong>.</p>
              </div>

              <Form onSubmit={handleSubmit}>
                <Form.Group className="auth-field">
                  <Form.Label>Email hoặc Số điện thoại</Form.Label>
                  <InputGroup className="auth-input-group">
                    <InputGroup.Text><Person size={18} /></InputGroup.Text>
                    <Form.Control
                      name="account"
                      placeholder="Nhập email hoặc số điện thoại"
                      value={formData.account}
                      onChange={handleChange}
                      className="border-0 bg-transparent shadow-none"
                    />
                  </InputGroup>
                </Form.Group>

                <Form.Group className="auth-field">
                  <div className="auth-label-row">
                    <Form.Label>Mật khẩu</Form.Label>
                    <Link to="/forgot-password">Quên mật khẩu?</Link>
                  </div>
                  <InputGroup className="auth-input-group">
                    <InputGroup.Text><Lock size={18} /></InputGroup.Text>
                    <Form.Control
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Nhập mật khẩu"
                      value={formData.password}
                      onChange={handleChange}
                      className="border-0 bg-transparent shadow-none"
                    />
                    <Button variant="link" onClick={() => setShowPassword(!showPassword)} className="auth-eye-btn">
                      {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </Button>
                  </InputGroup>
                </Form.Group>

                <Button type="submit" variant="success" disabled={loading} className="auth-submit-btn">
                  {loading ? <Spinner animation="border" size="sm" /> : 'Đăng nhập'}
                </Button>

                <div className="auth-divider"><span>Hoặc đăng nhập với</span></div>

                <p className="auth-policy-note">
                  Bằng việc đăng nhập, bạn đồng ý với <Link to="/terms">Điều khoản sử dụng</Link> và <Link to="/privacy">Chính sách bảo mật</Link>.
                </p>

                <div className="auth-google-wrap">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => Swal.fire('Lỗi', 'Không thể kết nối Google.', 'error')}
                    theme="outline"
                    shape="rectangular"
                    text="continue_with"
                    width="360"
                  />
                </div>

                <div className="auth-switch-link">
                  Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
                </div>
              </Form>
            </div>
          </Col>
        </Row>
      </Container>
    </Motion.div>
  );
};

export default LoginPage;
