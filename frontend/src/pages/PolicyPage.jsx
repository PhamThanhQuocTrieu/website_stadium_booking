import React, { useEffect, useState } from 'react';
import { Button, Container, Spinner } from 'react-bootstrap';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import '../styles/PolicyPage.css';

const formatDate = (value) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const PolicyPage = ({ type }) => {
  const navigate = useNavigate();
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isPrivacy = type === 'privacy';
  const Icon = isPrivacy ? ShieldCheck : FileText;

  useEffect(() => {
    const fetchPolicy = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await axiosClient.get(`/policies/${type}`);
        setPolicy(data);
      } catch (err) {
        setError('Không thể tải dữ liệu chính sách. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    };

    fetchPolicy();
  }, [type]);

  return (
    <div className="policy-public-page">
      <Container className="policy-public-container">
        <Button variant="light" className="policy-back-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
          <ArrowLeft size={18} /> Quay lại
        </Button>

        <section className="policy-public-card">
          {loading ? (
            <div className="policy-state">
              <Spinner animation="border" variant="success" />
              <p>Đang tải nội dung...</p>
            </div>
          ) : error ? (
            <div className="policy-state is-error">
              <Icon size={34} />
              <h2>Không thể tải dữ liệu</h2>
              <p>{error}</p>
              <Button variant="success" onClick={() => window.location.reload()}>Thử lại</Button>
            </div>
          ) : policy ? (
            <>
              <div className="policy-public-header">
                <div className="policy-icon"><Icon size={28} /></div>
                <span>{isPrivacy ? 'Bảo mật dữ liệu' : 'Quy định sử dụng'}</span>
                <h1>{policy.title}</h1>
                <p>Cập nhật lần cuối: {formatDate(policy.updatedAt)}</p>
              </div>
              <div
                className="policy-content"
                dangerouslySetInnerHTML={{ __html: policy.content }}
              />
            </>
          ) : (
            <div className="policy-state">
              <Icon size={34} />
              <h2>Chưa có nội dung</h2>
              <p>Nội dung chính sách đang được cập nhật.</p>
            </div>
          )}
        </section>
      </Container>
    </div>
  );
};

export default PolicyPage;
