import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Button,
  Row,
  Col,
  Spinner,
  Image,
  Badge,
} from 'react-bootstrap';
import {
  Camera,
  User,
  ShieldCheck,
  Mail,
  Phone,
  Calendar,
  Save,
} from 'lucide-react';
import axios from 'axios';
import api from '../../api/api';
import Swal from 'sweetalert2';
import '../../styles/admin/profile.css';

const Profile = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    dob: '',
    gender: 'Nam',
    avatar: '',
    password: '',
    newPassword: '',
    confirmPassword: '',
    role: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('userInfo'));
    if (user) {
      const dobFormatted = user.dob
        ? new Date(user.dob).toISOString().split('T')[0]
        : '';
      setFormData({
        ...user,
        dob: dobFormatted,
        password: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', 'arenahub_preset');

    setLoading(true);
    try {
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/dp8zttoxz/image/upload`,
        data
      );

      setFormData((prev) => ({
        ...prev,
        avatar: res.data.secure_url,
      }));
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Tải ảnh lên thành công!', showConfirmButton: false, timer: 1500 });
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Không thể đổi ảnh đại diện', 'error');
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
    const payload = {
        fullName: formData.fullName,
        phone: formData.phone,
        dob: formData.dob,
        avatar: formData.avatar,
        oldPassword: formData.password,
        newPassword: formData.newPassword
    };

    try {
      const res = await api.put(`/users/${formData._id}`, payload);
      localStorage.setItem('userInfo', JSON.stringify(res.data));
      Swal.fire('Thành công', 'Đã cập nhật hồ sơ!', 'success');
      setFormData(prev => ({ ...prev, password: '', newPassword: '', confirmPassword: '' }));
    } catch (err) {
      Swal.fire('Lỗi', err.response?.data?.message || 'Cập nhật thất bại', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modern-profile-page">
      <div className="profile-header">
        <div>
          <h2>Hồ sơ cá nhân</h2>
          <p>Quản lý thông tin và bảo mật tài khoản</p>
        </div>
        <Badge bg="success" className="profile-role">{formData.role}</Badge>
      </div>

      <Card className="modern-profile-card">
        <Row className="g-0">
          <Col lg={4} className="profile-sidebar">
            <div className="avatar-box">
              {/* 🌟 CLICk VÀO AVATAR ĐỂ CHỌN ẢNH */}
              <div className="avatar-wrapper" onClick={() => document.getElementById('avatar-input').click()}>
                <Image
                  src={formData.avatar || 'https://via.placeholder.com/200'}
                  roundedCircle
                  className="avatar-img"
                />
                <div className="avatar-upload">
                  {loading ? <Spinner size="sm" /> : <Camera size={18} />}
                </div>
                <input type="file" id="avatar-input" hidden onChange={handleAvatarChange} />
              </div>
              <h4>{formData.fullName}</h4>
              <p>{formData.email}</p>
            </div>

            <div className="profile-info-list">
              <div className="info-item"><Mail size={18} /> <span>{formData.email}</span></div>
              <div className="info-item"><Phone size={18} /> <span>{formData.phone || 'Chưa cập nhật'}</span></div>
              <div className="info-item"><Calendar size={18} /> <span>{formData.dob || 'Chưa cập nhật'}</span></div>
            </div>
          </Col>

          <Col lg={8}>
            <div className="profile-content">
              <Form onSubmit={handleSubmit}>
                <div className="section-title"><User size={20} /> <span>Thông tin cơ bản</span></div>
                <Row>
                  <Col md={6}><Form.Group className="mb-4"><Form.Label>Họ và tên</Form.Label><Form.Control name="fullName" value={formData.fullName} onChange={handleChange} /></Form.Group></Col>
                  <Col md={6}><Form.Group className="mb-4"><Form.Label>Email</Form.Label><Form.Control disabled value={formData.email} /></Form.Group></Col>
                  <Col md={6}><Form.Group className="mb-4"><Form.Label>Số điện thoại</Form.Label><Form.Control name="phone" value={formData.phone} onChange={handleChange} /></Form.Group></Col>
                  <Col md={6}><Form.Group className="mb-4"><Form.Label>Ngày sinh</Form.Label><Form.Control type="date" name="dob" value={formData.dob} onChange={handleChange} /></Form.Group></Col>
                </Row>

                <div className="section-title mt-2"><ShieldCheck size={20} /> <span>Bảo mật tài khoản</span></div>
                <Row>
                  <Col md={4}><Form.Group className="mb-4"><Form.Label>Mật khẩu cũ</Form.Label><Form.Control type="password" name="password" value={formData.password} onChange={handleChange} /></Form.Group></Col>
                  <Col md={4}><Form.Group className="mb-4"><Form.Label>Mật khẩu mới</Form.Label><Form.Control type="password" name="newPassword" value={formData.newPassword} onChange={handleChange} /></Form.Group></Col>
                  <Col md={4}><Form.Group className="mb-4"><Form.Label>Xác nhận</Form.Label><Form.Control type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} /></Form.Group></Col>
                </Row>

                <Button type="submit" className="save-btn" disabled={loading}>
                  {loading ? <Spinner size="sm" /> : <><Save size={18} /> Lưu thay đổi</>}
                </Button>
              </Form>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Profile;