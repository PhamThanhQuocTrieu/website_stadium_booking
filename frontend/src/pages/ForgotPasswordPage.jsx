import React, { useEffect, useMemo, useState } from 'react';
import { Button, Col, Container, Form, InputGroup, Row, Spinner } from 'react-bootstrap';
import { ArrowLeft, CheckCircleFill, Envelope, Eye, EyeSlash, Lock, ShieldLock } from 'react-bootstrap-icons';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';
import axiosClient from '../api/axiosClient';
import '../styles/forgot-password.css';

const RESEND_SECONDS = 60;
const OTP_EXPIRE_SECONDS = 60;

const steps = [
  { key: 1, label: 'Email' },
  { key: 2, label: 'OTP' },
  { key: 3, label: 'Mật khẩu mới' }
];

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const [expireLeft, setExpireLeft] = useState(0);

  useEffect(() => {
    if (resendLeft <= 0) return undefined;
    const timer = setInterval(() => setResendLeft((value) => Math.max(value - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [resendLeft]);

  useEffect(() => {
    if (expireLeft <= 0) return undefined;
    const timer = setInterval(() => setExpireLeft((value) => Math.max(value - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [expireLeft]);

  const expireLabel = useMemo(() => {
    const minutes = Math.floor(expireLeft / 60).toString().padStart(2, '0');
    const seconds = (expireLeft % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [expireLeft]);

  const beginOtpWindow = () => {
    setResendLeft(RESEND_SECONDS);
    setExpireLeft(OTP_EXPIRE_SECONDS);
  };

  const requestOtp = async (isResend = false) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      return Swal.fire({
        icon: 'warning',
        title: 'Email không hợp lệ',
        text: 'Vui lòng nhập email hợp lệ',
        confirmButtonColor: '#198754'
      });
    }

    setLoading(true);
    try {
      await axiosClient.post('/auth/forgot-password', { email: normalizedEmail });
      setEmail(normalizedEmail);
      setOtp('');
      setStep(2);
      beginOtpWindow();
      Swal.fire({
        icon: 'success',
        title: isResend ? 'Đã gửi lại mã OTP' : 'Đã gửi yêu cầu',
        text: 'Mã OTP đã được gửi nếu email tồn tại trong hệ thống',
        confirmButtonColor: '#198754'
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Không thể gửi OTP',
        text: error.response?.data?.message || 'Vui lòng thử lại sau.',
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return Swal.fire({
        icon: 'warning',
        title: 'OTP không hợp lệ',
        text: 'Vui lòng nhập mã OTP gồm 6 số',
        confirmButtonColor: '#198754'
      });
    }

    if (expireLeft <= 0) {
      return Swal.fire({
        icon: 'warning',
        title: 'OTP đã hết hạn',
        text: 'OTP đã hết hạn, vui lòng gửi lại mã mới',
        confirmButtonColor: '#198754'
      });
    }

    setLoading(true);
    try {
      await axiosClient.post('/auth/verify-reset-otp', { email, otp: cleanOtp });
      setStep(3);
      Swal.fire({
        icon: 'success',
        title: 'Xác thực thành công',
        text: 'Bạn có thể đặt mật khẩu mới.',
        timer: 1400,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'OTP không đúng',
        text: error.response?.data?.message || 'OTP không đúng, vui lòng kiểm tra lại',
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    if (newPassword.length < 6) {
      return Swal.fire({
        icon: 'warning',
        title: 'Mật khẩu quá ngắn',
        text: 'Mật khẩu mới phải có tối thiểu 6 ký tự',
        confirmButtonColor: '#198754'
      });
    }

    if (newPassword !== confirmPassword) {
      return Swal.fire({
        icon: 'warning',
        title: 'Mật khẩu không khớp',
        text: 'Mật khẩu xác nhận không trùng khớp',
        confirmButtonColor: '#198754'
      });
    }

    setLoading(true);
    try {
      await axiosClient.post('/auth/reset-password', {
        email,
        otp,
        newPassword,
        confirmPassword
      });

      await Swal.fire({
        icon: 'success',
        title: 'Thành công',
        text: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại',
        confirmButtonColor: '#198754'
      });
      navigate('/login');
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Không thể đặt lại mật khẩu',
        text: error.response?.data?.message || 'Vui lòng thử lại sau.',
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Container fluid className="forgot-page">
        <Row className="forgot-shell">
          <Col lg={5} className="forgot-brand-panel d-none d-lg-flex">
            <Link to="/login" className="forgot-back-link">
              <ArrowLeft className="me-2" /> Quay lại đăng nhập
            </Link>

            <div className="forgot-brand-content">
              <div className="forgot-logo">
                <ShieldLock size={34} />
              </div>
              <h1>Lấy lại quyền truy cập ArenaHub</h1>
              <p>Mã OTP được gửi qua email và chỉ có hiệu lực trong 1 phút để bảo vệ tài khoản của bạn.</p>
            </div>
          </Col>

          <Col lg={7} className="forgot-form-panel">
            <div className="forgot-card">
              <div className="forgot-heading">
                <span className="forgot-kicker">Bảo mật tài khoản</span>
                <h2>Quên mật khẩu?</h2>
                <p>Hoàn tất 3 bước ngắn để đặt lại mật khẩu ArenaHub.</p>
              </div>

              <div className="forgot-steps" aria-label="Tiến trình đặt lại mật khẩu">
                {steps.map((item) => (
                  <div className={`forgot-step ${step >= item.key ? 'active' : ''}`} key={item.key}>
                    <span>{step > item.key ? <CheckCircleFill /> : item.key}</span>
                    <strong>{item.label}</strong>
                  </div>
                ))}
              </div>

              {step === 1 && (
                <Form onSubmit={(event) => { event.preventDefault(); requestOtp(false); }}>
                  <Form.Group className="forgot-field">
                    <Form.Label>Email tài khoản</Form.Label>
                    <InputGroup className="forgot-input-group">
                      <InputGroup.Text><Envelope size={18} /></InputGroup.Text>
                      <Form.Control
                        type="email"
                        placeholder="email@vidu.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="border-0 bg-transparent shadow-none"
                      />
                    </InputGroup>
                  </Form.Group>

                  <Button type="submit" className="forgot-submit" disabled={loading}>
                    {loading ? <Spinner animation="border" size="sm" /> : 'Gửi mã OTP'}
                  </Button>
                </Form>
              )}

              {step === 2 && (
                <Form onSubmit={verifyOtp}>
                  <div className="forgot-info">
                    Mã OTP đã được gửi nếu <strong>{email}</strong> tồn tại trong hệ thống.
                  </div>

                  <Form.Group className="forgot-field">
                    <Form.Label>Mã OTP 6 số</Form.Label>
                    <InputGroup className="forgot-input-group forgot-otp-input">
                      <InputGroup.Text><ShieldLock size={18} /></InputGroup.Text>
                      <Form.Control
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="border-0 bg-transparent shadow-none"
                      />
                    </InputGroup>
                  </Form.Group>

                  <div className={`forgot-expire ${expireLeft <= 0 ? 'expired' : ''}`}>
                    {expireLeft > 0 ? `OTP hết hạn sau ${expireLabel}` : 'OTP đã hết hạn, vui lòng gửi lại mã mới'}
                  </div>

                  <Button type="submit" className="forgot-submit" disabled={loading || expireLeft <= 0}>
                    {loading ? <Spinner animation="border" size="sm" /> : 'Xác nhận OTP'}
                  </Button>

                  <Button
                    type="button"
                    variant="link"
                    className="forgot-resend"
                    disabled={loading || resendLeft > 0}
                    onClick={() => requestOtp(true)}
                  >
                    {resendLeft > 0 ? `Gửi lại mã sau ${resendLeft}s` : 'Gửi lại mã'}
                  </Button>
                </Form>
              )}

              {step === 3 && (
                <Form onSubmit={resetPassword}>
                  <Form.Group className="forgot-field">
                    <Form.Label>Mật khẩu mới</Form.Label>
                    <InputGroup className="forgot-input-group">
                      <InputGroup.Text><Lock size={18} /></InputGroup.Text>
                      <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Tối thiểu 6 ký tự"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="border-0 bg-transparent shadow-none"
                      />
                      <Button type="button" variant="link" className="forgot-eye" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeSlash size={17} /> : <Eye size={17} />}
                      </Button>
                    </InputGroup>
                  </Form.Group>

                  <Form.Group className="forgot-field">
                    <Form.Label>Xác nhận mật khẩu</Form.Label>
                    <InputGroup className="forgot-input-group">
                      <InputGroup.Text><ShieldLock size={18} /></InputGroup.Text>
                      <Form.Control
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Nhập lại mật khẩu mới"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="border-0 bg-transparent shadow-none"
                      />
                      <Button type="button" variant="link" className="forgot-eye" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                        {showConfirmPassword ? <EyeSlash size={17} /> : <Eye size={17} />}
                      </Button>
                    </InputGroup>
                  </Form.Group>

                  <Button type="submit" className="forgot-submit" disabled={loading}>
                    {loading ? <Spinner animation="border" size="sm" /> : 'Đặt lại mật khẩu'}
                  </Button>
                </Form>
              )}

              <div className="forgot-bottom-link">
                Đã nhớ mật khẩu? <Link to="/login">Đăng nhập</Link>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </motion.div>
  );
};

export default ForgotPasswordPage;
