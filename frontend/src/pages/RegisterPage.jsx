import React, { useMemo, useState } from 'react';
import { Container, Row, Col, Form, Button, InputGroup, Spinner } from 'react-bootstrap';
import { Eye, EyeSlash, Envelope, Person, Lock, ShieldCheck, Trophy, Stars, CheckCircleFill, ArrowLeft, People, CalendarCheck, Award } from 'react-bootstrap-icons';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import Swal from 'sweetalert2';
import '../styles/LoginPage.css';

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
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordRules = useMemo(() => {
    const password = formData.password || '';
    return [
      { label: 'Ít nhất 8 ký tự', done: password.length >= 8 },
      { label: 'Bao gồm số', done: /\d/.test(password) },
      { label: 'Bao gồm chữ hoa và chữ thường', done: /[a-z]/.test(password) && /[A-Z]/.test(password) },
      { label: 'Bao gồm ký tự đặc biệt', done: /[^A-Za-z0-9]/.test(password) }
    ];
  }, [formData.password]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.password || !formData.confirmPassword) {
      return Swal.fire({
        icon: 'warning',
        title: 'Thiếu thông tin',
        text: 'Vui lòng điền đầy đủ các trường có dấu sao (*)',
        confirmButtonColor: '#198754'
      });
    }

    if (formData.password !== formData.confirmPassword) {
      return Swal.fire({
        icon: 'error',
        title: 'Mật khẩu không khớp',
        text: 'Vui lòng kiểm tra lại mật khẩu xác nhận của bạn.',
        confirmButtonColor: '#d33'
      });
    }

    if (!acceptedPolicies) {
      return Swal.fire({
        icon: 'warning',
        title: 'Chưa đồng ý điều khoản',
        text: 'Vui lòng đồng ý Điều khoản sử dụng và Chính sách bảo mật trước khi đăng ký.',
        confirmButtonColor: '#198754'
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

      Swal.fire({
        icon: 'success',
        title: 'Đăng ký thành công!',
        text: 'Chào mừng bạn đã gia nhập ArenaHub. Hãy đăng nhập để bắt đầu trải nghiệm!',
        confirmButtonColor: '#198754',
        confirmButtonText: 'Đến trang Đăng nhập',
        allowOutsideClick: false
      }).then((result) => {
        if (result.isConfirmed) navigate('/login');
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi đăng ký',
        text: err.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.',
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/users/google-auth', {
        idToken: credentialResponse.credential
      });

      localStorage.setItem('userToken', res.data.token);
      localStorage.setItem('userInfo', JSON.stringify(res.data));
      window.dispatchEvent(new Event('authChanged'));

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
    >
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

              <div className="auth-benefit-list">
                <div>
                  <span><People /></span>
                  <div><strong>Kết nối cộng đồng</strong><p>Tham gia cộng đồng thể thao sôi động và thân thiện.</p></div>
                </div>
                <div>
                  <span><CalendarCheck /></span>
                  <div><strong>Đặt sân nhanh chóng</strong><p>Dễ dàng đặt sân mọi lúc, mọi nơi chỉ với vài thao tác.</p></div>
                </div>
                <div>
                  <span><Award /></span>
                  <div><strong>Nhiều ưu đãi hấp dẫn</strong><p>Nhận ưu đãi và tham gia giải đấu dành riêng cho bạn.</p></div>
                </div>
              </div>
            </div>

            <div className="auth-brand-footer">
              <Trophy className="text-warning me-2" /> Tham gia ngay cộng đồng thể thao ArenaHub.
              <span>Hơn 10.000+ thành viên đã đồng hành cùng chúng tôi.</span>
            </div>
          </Col>

          <Col lg={7} className="auth-form-panel">
            <div className="auth-card auth-card-register">
              <div className="auth-form-heading text-center text-lg-start">
                <h3>Tạo tài khoản <strong>ArenaHub</strong></h3>
                <p>Tham gia để khám phá và trải nghiệm ngay!</p>
              </div>

              <Form onSubmit={handleSubmit}>
                <Form.Group className="auth-field compact">
                  <Form.Label>Họ và tên</Form.Label>
                  <InputGroup className="auth-input-group">
                    <InputGroup.Text><Person size={17} /></InputGroup.Text>
                    <Form.Control
                      type="text"
                      name="fullName"
                      placeholder="Nhập họ và tên của bạn"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="border-0 bg-transparent shadow-none"
                    />
                  </InputGroup>
                </Form.Group>

                <Form.Group className="auth-field compact">
                  <Form.Label>Email hoặc Số điện thoại</Form.Label>
                  <InputGroup className="auth-input-group">
                    <InputGroup.Text><Envelope size={17} /></InputGroup.Text>
                    <Form.Control
                      type="text"
                      name="email"
                      placeholder="Nhập email hoặc số điện thoại"
                      value={formData.email}
                      onChange={handleChange}
                      className="border-0 bg-transparent shadow-none"
                    />
                  </InputGroup>
                </Form.Group>

                <Form.Group className="auth-field compact">
                  <Form.Label>Mật khẩu</Form.Label>
                  <InputGroup className="auth-input-group">
                    <InputGroup.Text><Lock size={17} /></InputGroup.Text>
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

                <Form.Group className="auth-field compact">
                  <Form.Label>Xác nhận mật khẩu</Form.Label>
                  <InputGroup className="auth-input-group">
                    <InputGroup.Text><ShieldCheck size={17} /></InputGroup.Text>
                    <Form.Control
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      placeholder="Nhập lại mật khẩu"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="border-0 bg-transparent shadow-none"
                    />
                    <Button variant="link" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="auth-eye-btn">
                      {showConfirmPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </Button>
                  </InputGroup>
                </Form.Group>

                <div className="auth-password-rules">
                  {passwordRules.map((rule) => (
                    <span className={rule.done ? 'done' : ''} key={rule.label}>
                      <CheckCircleFill /> {rule.label}
                    </span>
                  ))}
                </div>

                <label className="auth-policy-check">
                  <Form.Check.Input
                    type="checkbox"
                    checked={acceptedPolicies}
                    onChange={(event) => setAcceptedPolicies(event.target.checked)}
                  />
                  <span>
                    Tôi đồng ý với <Link to="/terms">Điều khoản sử dụng</Link> và <Link to="/privacy">Chính sách bảo mật</Link>
                  </span>
                </label>

                <Button type="submit" variant="success" disabled={loading || !acceptedPolicies} className="auth-submit-btn">
                  {loading ? <Spinner animation="border" size="sm" /> : 'Đăng ký'}
                </Button>

                <p className="auth-terms">
                  Bằng cách đăng ký, bạn đồng ý với <Link to="/support">Điều khoản sử dụng</Link> và <Link to="/support">Chính sách bảo mật</Link>
                </p>

                <div className="auth-divider"><span>Hoặc đăng ký với</span></div>

                <div className="auth-google-wrap">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => Swal.fire('Lỗi', 'Đăng nhập Google thất bại', 'error')}
                    theme="outline"
                    shape="rectangular"
                    text="continue_with"
                    width="360"
                  />
                </div>

                <div className="auth-switch-link">
                  Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
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
