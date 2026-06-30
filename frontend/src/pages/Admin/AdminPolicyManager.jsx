import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Spinner, Tab, Tabs } from 'react-bootstrap';
import { FileText, Save, ShieldCheck } from 'lucide-react';
import Swal from 'sweetalert2';
import axiosClient from '../../api/axiosClient';
import RichTextEditor from '../../components/RichTextEditor';
import '../../styles/admin/policyManager.css';

const labels = {
  terms: { title: 'Điều khoản sử dụng', icon: FileText },
  privacy: { title: 'Chính sách bảo mật', icon: ShieldCheck }
};

const formatDateTime = (value) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return date.toLocaleString('vi-VN');
};

const AdminPolicyManager = () => {
  const [policies, setPolicies] = useState([]);
  const [activeKey, setActiveKey] = useState('terms');
  const [formData, setFormData] = useState({ title: '', content: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activePolicy = useMemo(
    () => policies.find((policy) => policy.type === activeKey),
    [policies, activeKey]
  );

  useEffect(() => {
    fetchPolicies();
  }, []);

  useEffect(() => {
    if (activePolicy) {
      setFormData({
        title: activePolicy.title || '',
        content: activePolicy.content || ''
      });
    }
  }, [activePolicy]);

  const fetchPolicies = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.get('/policies');
      setPolicies(Array.isArray(data) ? data : []);
    } catch {
      setError('Không thể tải dữ liệu chính sách. Vui lòng thử lại.');
      Swal.fire('Lỗi', 'Không thể tải dữ liệu chính sách. Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activePolicy?._id) {
      return Swal.fire('Lỗi', 'Không tìm thấy chính sách cần cập nhật.', 'error');
    }
    if (!formData.title.trim() || !formData.content.trim()) {
      return Swal.fire('Thiếu thông tin', 'Tiêu đề và nội dung không được để trống.', 'warning');
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        title: formData.title.trim(),
        content: formData.content
      };
      const { data } = await axiosClient.put(`/policies/${activePolicy._id}`, payload);
      setPolicies((prev) => prev.map((item) => (item._id === data._id ? data : item)));
      Swal.fire('Thành công', 'Đã lưu thay đổi chính sách.', 'success');
    } catch (err) {
      Swal.fire('Lỗi', err.response?.data?.message || 'Không thể lưu chính sách.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderEditor = () => {
    if (loading) {
      return (
        <div className="policy-admin-state">
          <Spinner animation="border" variant="success" />
          <p>Đang tải dữ liệu chính sách...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="policy-admin-state is-error">
          <p>{error}</p>
          <Button variant="success" onClick={fetchPolicies}>Thử lại</Button>
        </div>
      );
    }

    if (!activePolicy) {
      return (
        <div className="policy-admin-state">
          <p>Chưa có dữ liệu cho mục này.</p>
        </div>
      );
    }

    const Icon = labels[activeKey].icon;
    return (
      <div className="policy-editor">
        <div className="policy-editor-meta">
          <div>
            <span className="policy-editor-icon"><Icon size={20} /></span>
            <div>
              <strong>{labels[activeKey].title}</strong>
              <p>Cập nhật lần cuối: {formatDateTime(activePolicy.updatedAt)}</p>
            </div>
          </div>
          <Button className="policy-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner animation="border" size="sm" /> : <><Save size={17} /> Lưu thay đổi</>}
          </Button>
        </div>

        <Form.Group className="mb-3">
          <Form.Label>Tiêu đề</Form.Label>
          <Form.Control
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Nhập tiêu đề chính sách"
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Nội dung</Form.Label>
          <RichTextEditor
            value={formData.content}
            onChange={(html) => setFormData((prev) => ({ ...prev, content: html }))}
            placeholder="Nhập nội dung..."
            height={420}
          />
        </Form.Group>
      </div>
    );
  };

  return (
    <div className="policy-manager-page">
      <div className="policy-manager-header">
        <span>ARENAHUB ADMIN</span>
        <h1>Quản lý chính sách</h1>
        <p>Cập nhật Điều khoản sử dụng và Chính sách bảo mật hiển thị cho người dùng.</p>
      </div>

      <Card className="policy-manager-card">
        <Card.Body>
          <Tabs activeKey={activeKey} onSelect={(key) => setActiveKey(key || 'terms')} className="policy-tabs">
            <Tab eventKey="terms" title="Điều khoản sử dụng" />
            <Tab eventKey="privacy" title="Chính sách bảo mật" />
          </Tabs>
          {renderEditor()}
        </Card.Body>
      </Card>
    </div>
  );
};

export default AdminPolicyManager;
