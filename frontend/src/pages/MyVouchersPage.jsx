import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Col, Container, Row, Spinner } from 'react-bootstrap';
import { CalendarDays, Ticket, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import '../styles/MyVouchersPage.css';

const tabs = [
  { key: 'available', label: 'Khả dụng' },
  { key: 'used', label: 'Đã dùng' },
  { key: 'expired', label: 'Hết hạn' }
];

const statusLabels = {
  available: 'Khả dụng',
  used: 'Đã dùng',
  expired: 'Hết hạn'
};

const formatCurrency = (amount) => Number(amount || 0).toLocaleString('vi-VN');

const formatDiscount = (voucher) => (
  voucher.discountType === 'fixed'
    ? `Giảm ${formatCurrency(voucher.discountValue)}đ`
    : `Giảm ${voucher.discountValue}%`
);

const conditionText = (voucher) => {
  const labels = {
    all: 'Áp dụng toàn hệ thống',
    new_user: 'Chỉ áp dụng cho khách hàng mới',
    field: 'Áp dụng theo sân được chọn',
    sport_type: `Áp dụng môn: ${(voucher.sportTypes || []).join(', ')}`,
    time_slot: `Áp dụng ${voucher.validTimeFrom || '--:--'} - ${voucher.validTimeTo || '--:--'}`,
    weekend: 'Chỉ áp dụng thứ 7 và chủ nhật'
  };
  return labels[voucher.applyType] || labels.all;
};

const VoucherCard = ({ voucher, onUse }) => (
  <div className={`user-voucher-card ${voucher.status}`}>
    <div className="voucher-ribbon">
      <Ticket size={22} />
      <span>{voucher.code}</span>
    </div>
    <div className="voucher-card-body">
      <div className="d-flex justify-content-between gap-3">
        <div>
          <h5>{voucher.name}</h5>
          <p className="voucher-discount">{formatDiscount(voucher)}</p>
        </div>
        <Badge bg={voucher.status === 'available' ? 'success' : voucher.status === 'used' ? 'secondary' : 'danger'}>
          {statusLabels[voucher.status] || voucher.status}
        </Badge>
      </div>
      <div className="voucher-meta">
        <span>Đơn tối thiểu: {formatCurrency(voucher.minOrderAmount)}đ</span>
        <span>Giảm tối đa: {formatCurrency(voucher.maxDiscount)}đ</span>
        <span>Hạn dùng: {voucher.endDate ? new Date(voucher.endDate).toLocaleDateString('vi-VN') : '-'}</span>
        <span>{voucher.description || conditionText(voucher)}</span>
      </div>
      <Button variant="success" disabled={voucher.status !== 'available'} onClick={onUse}>
        Dùng ngay
      </Button>
    </div>
  </div>
);

const MyVouchersPage = () => {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState([]);
  const [activeTab, setActiveTab] = useState('available');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVouchers = async () => {
      try {
        const res = await api.get('/user/vouchers', { params: { includePublic: true } });
        setVouchers(Array.isArray(res.data) ? res.data : []);
      } finally {
        setLoading(false);
      }
    };
    fetchVouchers();
  }, []);

  const grouped = useMemo(() => ({
    available: vouchers.filter((voucher) => voucher.status === 'available'),
    used: vouchers.filter((voucher) => voucher.status === 'used'),
    expired: vouchers.filter((voucher) => voucher.status === 'expired')
  }), [vouchers]);

  return (
    <div className="my-vouchers-page">
      <Container>
        <div className="voucher-page-header">
          <div>
            <div className="eyebrow"><WalletCards size={18} /> ArenaHub rewards</div>
            <h2>Voucher của tôi</h2>
          </div>
          <Button variant="outline-success" onClick={() => navigate('/fields')}>Đặt sân ngay</Button>
        </div>

        <div className="voucher-tabs">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>
              {tab.label} <span>{grouped[tab.key].length}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" variant="success" /></div>
        ) : grouped[activeTab].length === 0 ? (
          <div className="empty-voucher-state">
            <CalendarDays size={40} />
            <h5>Chưa có voucher trong mục này</h5>
            <p>Voucher được tặng tự động sẽ xuất hiện ở đây.</p>
          </div>
        ) : (
          <Row className="g-4">
            {grouped[activeTab].map((voucher) => (
              <Col lg={6} key={`${voucher.voucherId || voucher._id}-${voucher.status}`}>
                <VoucherCard voucher={voucher} onUse={() => navigate('/fields')} />
              </Col>
            ))}
          </Row>
        )}
      </Container>
    </div>
  );
};

export default MyVouchersPage;
