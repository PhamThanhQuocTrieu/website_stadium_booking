import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Col, Container, Row, Spinner } from 'react-bootstrap';
import { Ticket, CalendarDays, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import '../styles/MyVouchersPage.css';

const tabs = [
  { key: 'available', label: 'Kha dung' },
  { key: 'used', label: 'Da dung' },
  { key: 'expired', label: 'Het han' }
];

const formatCurrency = (amount) => Number(amount || 0).toLocaleString('vi-VN');
const formatDiscount = (voucher) => (
  voucher.discountType === 'fixed'
    ? `Giam ${formatCurrency(voucher.discountValue)}d`
    : `Giam ${voucher.discountValue}%`
);
const conditionText = (voucher) => {
  const labels = {
    all: 'Ap dung toan he thong',
    new_user: 'Chi ap dung cho khach hang moi',
    field: 'Ap dung theo san duoc chon',
    sport_type: `Ap dung mon: ${(voucher.sportTypes || []).join(', ')}`,
    time_slot: `Ap dung ${voucher.validTimeFrom || '--:--'} - ${voucher.validTimeTo || '--:--'}`
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
        <Badge bg={voucher.status === 'available' ? 'success' : voucher.status === 'used' ? 'secondary' : 'danger'}>{voucher.status}</Badge>
      </div>
      <div className="voucher-meta">
        <span>Don toi thieu: {formatCurrency(voucher.minOrderAmount)}d</span>
        <span>Giam toi da: {formatCurrency(voucher.maxDiscount)}d</span>
        <span>Han dung: {voucher.endDate ? new Date(voucher.endDate).toLocaleDateString('vi-VN') : '-'}</span>
        <span>{conditionText(voucher)}</span>
      </div>
      <Button variant="success" disabled={voucher.status !== 'available'} onClick={onUse}>
        Dung ngay
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
        const res = await api.get('/user/vouchers');
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
            <h2>Voucher cua toi</h2>
          </div>
          <Button variant="outline-success" onClick={() => navigate('/fields')}>Dat san ngay</Button>
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
            <h5>Chua co voucher trong muc nay</h5>
            <p>Voucher duoc tang tu dong se xuat hien o day.</p>
          </div>
        ) : (
          <Row className="g-4">
            {grouped[activeTab].map((voucher) => (
              <Col lg={6} key={voucher._id}>
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
