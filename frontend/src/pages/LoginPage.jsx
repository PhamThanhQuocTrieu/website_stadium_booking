import React, { useState } from 'react';
import { Container, Row, Col, Form, Button, InputGroup, Spinner } from 'react-bootstrap';
import { Eye, EyeSlash, Person, Lock, Stars, Trophy, ArrowLeft } from 'react-bootstrap-icons';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import Swal from 'sweetalert2';

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

      // 🌟 FIX: Điều hướng tới /admin để khớp với index route trong App.js
      setTimeout(() => {
        if (isAdmin) {
          navigate('/admin'); 
        } else {
          navigate('/');
        }
      }, 1500);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.account.trim() || !formData.password) {
      return Swal.fire({ icon: 'warning', title: 'Thiếu thông tin', text: 'Vui lòng nhập Email và Mật khẩu.', confirmButtonColor: '#198754' });
    }

    setLoading(true);
    try {
      const { data } = await axios.post('http://localhost:5000/api/users/login', {
        account: formData.account.trim().toLowerCase(),
        password: formData.password
      });
      handleLoginSuccess(data);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Lỗi', text: err.response?.data?.message || 'Đăng nhập thất bại.', confirmButtonColor: '#d33' });
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
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Xác thực Google thất bại.', confirmButtonColor: '#d33' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
      <Container fluid className="p-0" style={{ height: '100vh' }}>
        <Row className="g-0" style={{ height: '100vh' }}>
          <Col lg={5} className="d-none d-lg-flex flex-column justify-content-between p-5 text-white" 
               style={{ background: 'linear-gradient(135deg, #111b24 0%, #1c2e3d 100%)' }}>
            <Link to="/" className="text-white text-decoration-none d-flex align-items-center opacity-75">
              <ArrowLeft className="me-2" /> Quay về Trang chủ
            </Link>
            <div>
              <div className="d-flex align-items-center mb-5">
                <div className="rounded-3 me-3 d-flex align-items-center justify-content-center" style={{ width: '52px', height: '52px', background: '#198754' }}>
                  <Stars size={28} className="text-white" />
                </div>
                <h1 className="fw-bold mb-0">ArenaHub</h1>
              </div>
              <h2 className="fw-bold mb-4">Chào mừng bạn trở lại với <span className="text-success">ArenaHub</span></h2>
            </div>
            <div className="pt-4 border-top border-secondary border-opacity-50 text-light opacity-75 small">
              <Trophy className="text-warning me-2" /> Tham gia ngay cộng đồng thể thao ArenaHub.
            </div>
          </Col>

          <Col lg={7} className="d-flex align-items-center justify-content-center p-4 bg-white">
            <div style={{ maxWidth: '420px', width: '100%' }}>
              <h3 className="fw-bold mb-1">Đăng nhập</h3>
              <p className="text-muted small mb-4">Sử dụng tài khoản ArenaHub của bạn.</p>

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-secondary">Email hoặc Số điện thoại</Form.Label>
                  <InputGroup className="border rounded-3 overflow-hidden bg-light" style={{ height: '48px' }}>
                    <InputGroup.Text className="bg-transparent border-0"><Person size={18} /></InputGroup.Text>
                    <Form.Control name="account" value={formData.account} onChange={handleChange} className="border-0 bg-transparent shadow-none" />
                  </InputGroup>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label className="small fw-bold text-secondary">Mật khẩu</Form.Label>
                  <InputGroup className="border rounded-3 overflow-hidden bg-light" style={{ height: '48px' }}>
                    <InputGroup.Text className="bg-transparent border-0"><Lock size={18} /></InputGroup.Text>
                    <Form.Control type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} className="border-0 bg-transparent shadow-none" />
                    <Button variant="link" onClick={() => setShowPassword(!showPassword)} className="text-muted border-0 shadow-none">
                      {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </Button>
                  </InputGroup>
                </Form.Group>

                <Button type="submit" variant="success" disabled={loading} className="w-100 rounded-pill fw-bold mb-3 shadow-sm" style={{ height: '48px', backgroundColor: '#198754' }}>
                  {loading ? <Spinner animation="border" size="sm" /> : 'Đăng Nhập'}
                </Button>

                <div className="text-center mt-3">
                  <p className="text-muted small mb-3">Hoặc đăng nhập với</p>
                  <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => Swal.fire('Lỗi', 'Không thể kết nối Google.', 'error')} theme="outline" shape="pill" />
                </div>
              </Form>
            </div>
          </Col>
        </Row>
      </Container>
    </motion.div>
  );
};

export default LoginPage;
