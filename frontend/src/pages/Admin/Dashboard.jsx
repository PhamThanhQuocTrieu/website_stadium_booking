// File: Frontend/src/pages/Admin/Dashboard.jsx
import React from 'react';
import { Row, Col, Card } from 'react-bootstrap';
import { DollarSign, CalendarCheck, MapPin, Users } from 'lucide-react';

// Import CSS đã tách
import '../../styles/admin/dashboard.css';

const StatCard = ({ title, value, icon, color }) => (
  <Card className="border-0 shadow-sm rounded-4 p-3 mb-4 stat-card">
    <div className="d-flex align-items-center justify-content-between">
      <div>
        <h6 className="text-muted mb-1">{title}</h6>
        <h3 className="fw-black mb-0">{value}</h3>
      </div>
      <div className={`p-3 rounded-circle bg-opacity-10 bg-${color} text-${color}`}>
        {icon}
      </div>
    </div>
  </Card>
);

const Dashboard = () => {
  return (
    <div className="p-4">
      <h3 className="fw-bold mb-4">Tổng quan hệ thống</h3>
      
      <Row>
        <Col md={3}><StatCard title="Doanh thu tháng" value="45.2Mđ" icon={<DollarSign size={20}/>} color="success" /></Col>
        <Col md={3}><StatCard title="Tổng lượt đặt" value="128" icon={<CalendarCheck size={20}/>} color="primary" /></Col>
        <Col md={3}><StatCard title="Sân đang chạy" value="12" icon={<MapPin size={20}/>} color="info" /></Col>
        <Col md={3}><StatCard title="Khách hàng mới" value="+24" icon={<Users size={20}/>} color="warning" /></Col>
      </Row>
      
      <Card className="border-0 shadow-sm rounded-4 mt-4 p-4">
        <h5 className="mb-4">Biểu đồ doanh thu</h5>
        <div className="chart-container">
          <p>Khu vực tích hợp Chart.js (Biểu đồ lịch biểu tương tác)</p>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;