import React, { useState, useEffect } from 'react';
import { Card, Button, Row, Col, Spinner, Image, Container, Form } from 'react-bootstrap';
import { Camera, User, ShieldCheck, Mail, Phone, Calendar, Save } from 'lucide-react';
import axios from 'axios';
import api from '../api/api'; // <--- IMPORT INSTANCE ĐÃ CẤU HÌNH TOKEN
import Swal from 'sweetalert2';
import '../styles/user-profile.css';

const UserProfile = () => {
  const [formData, setFormData] = useState({ 
    fullName: '', email: '', phone: '', dob: '', avatar: '', 
    oldPassword: '', newPassword: '', confirmPassword: '' 
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      const user = JSON.parse(userInfo);
      const dobFormatted = user.dob ? new Date(user.dob).toISOString().split('T')[0] : '';
      setFormData(prev => ({ ...prev, ...user, dob: dobFormatted }));
    }
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', 'arenahub_preset'); 
    
    setLoading(true);
    try {
      const res = await axios.post(`https://api.cloudinary.com/v1_1/dp8zttoxz/image/upload`, data);
      setFormData(prev => ({ ...prev, avatar: res.data.secure_url }));
      Swal.fire({ icon: 'success', title: 'Đã tải ảnh lên!', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Lỗi', 'Không thể upload ảnh!', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      return Swal.fire('Lỗi', 'Mật khẩu mới không khớp!', 'error');
    }

    setLoading(true);
    try {
      const userLocal = JSON.parse(localStorage.getItem('userInfo'));
      
      // SỬ DỤNG 'api.put' THAY VÌ 'axios.put'
      // 'api' đã tự động chèn token vào header thông qua interceptor
      const res = await api.put(`/users/${userLocal._id}`, formData);
      
      localStorage.setItem('userInfo', JSON.stringify(res.data));
      window.dispatchEvent(new Event('storage'));
      
      setFormData(prev => ({ ...prev, oldPassword: '', newPassword: '', confirmPassword: '' }));
      Swal.fire('Thành công', 'Đã cập nhật hồ sơ!', 'success');
    } catch (err) {
      console.error("Lỗi cập nhật:", err.response?.data);
      Swal.fire('Lỗi', err.response?.data?.message || 'Cập nhật thất bại!', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <Container>
        <Card className="profile-card">
          <Row className="g-0">
            {/* CỘT TRÁI */}
            <Col lg={4} className="profile-sidebar">
              <div className="avatar-section">
                <label className="avatar-wrapper" style={{ cursor: 'pointer' }}>
                  <Image src={formData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.fullName)}&background=198754&color=fff`} className="avatar-img" />
                  <div className="avatar-overlay"><Camera size={30} /></div>
                  <input type="file" hidden onChange={handleAvatarChange} />
                </label>
                <h4 className="fw-bold mt-3">{formData.fullName}</h4>
                <p className="text-muted small mb-3">{formData.email}</p>
                <div className="member-badge">Thành viên ArenaHub</div>
              </div>
              <div className="info-list px-3">
                <div className="info-card"><Mail size={20} /> <span>{formData.email}</span></div>
                <div className="info-card"><Phone size={20} /> <span>{formData.phone || 'Chưa cập nhật'}</span></div>
                <div className="info-card"><Calendar size={20} /> <span>{formData.dob || 'Chưa cập nhật'}</span></div>
              </div>
            </Col>

            {/* CỘT PHẢI */}
            <Col lg={8} className="profile-content ps-5"> 
              <Form onSubmit={handleSubmit}>
                <div className="section-title"><User size={22} /> <span>Thông tin cá nhân</span></div>
                <Row>
                  <Col md={6}><Form.Group className="mb-4"><Form.Label>HỌ VÀ TÊN</Form.Label><Form.Control name="fullName" value={formData.fullName} onChange={handleChange} /></Form.Group></Col>
                  <Col md={6}><Form.Group className="mb-4"><Form.Label>EMAIL</Form.Label><Form.Control disabled value={formData.email} /></Form.Group></Col>
                  <Col md={6}><Form.Group className="mb-4"><Form.Label>NGÀY SINH</Form.Label><Form.Control type="date" name="dob" value={formData.dob} onChange={handleChange} /></Form.Group></Col>
                  <Col md={6}><Form.Group className="mb-4"><Form.Label>SỐ ĐIỆN THOẠI</Form.Label><Form.Control name="phone" value={formData.phone} onChange={handleChange} /></Form.Group></Col>
                </Row>

                <div className="section-title security-title"><ShieldCheck size={22} /> <span>Bảo mật tài khoản</span></div>
                <Row>
                  <Col md={4}><Form.Group className="mb-4"><Form.Label>MK CŨ</Form.Label><Form.Control type="password" name="oldPassword" value={formData.oldPassword} onChange={handleChange} /></Form.Group></Col>
                  <Col md={4}><Form.Group className="mb-4"><Form.Label>MK MỚI</Form.Label><Form.Control type="password" name="newPassword" value={formData.newPassword} onChange={handleChange} /></Form.Group></Col>
                  <Col md={4}><Form.Group className="mb-4"><Form.Label>XÁC NHẬN MK</Form.Label><Form.Control type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} /></Form.Group></Col>
                </Row>
                
                <Button type="submit" className="save-btn" disabled={loading}>
                  {loading ? <Spinner size="sm" /> : <><Save size={18} className="me-2"/> Lưu thay đổi</>}
                </Button>
              </Form>
            </Col>
          </Row>
        </Card>
      </Container>
    </div>
  );
};
export default UserProfile;