import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPinned,
  CalendarDays,
  CalendarClock,
  Users,
  LogOut,
  UserCircle,
  TicketPercent,
  ShoppingBasket,
  MessageSquare,
  Mail,
  BellRing,
  ScrollText
} from 'lucide-react';
import Swal from 'sweetalert2';

import '../../styles/admin/layout.css';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    Swal.fire({
      title: 'Đăng xuất?',
      text: 'Bạn có chắc chắn muốn rời khỏi trang quản trị?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Đăng xuất',
      cancelButtonText: 'Hủy'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userInfo');
        navigate('/login');
      }
    });
  };

  const menuItems = [
    { path: '/admin', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { path: '/admin/fields', icon: <MapPinned size={20} />, label: 'Quản lý sân' },
    { path: '/admin/bookings', icon: <CalendarDays size={20} />, label: 'Đơn đặt sân' },
    { path: '/admin/schedule-manager', icon: <CalendarClock size={20} />, label: 'Quản lý lịch sân' },
    { path: '/admin/users', icon: <Users size={20} />, label: 'Người dùng' },
    { path: '/admin/vouchers', icon: <TicketPercent size={20} />, label: 'Mã giảm giá' },
    { path: '/admin/services', icon: <ShoppingBasket size={20} />, label: 'Dịch vụ đi kèm' },
    { path: '/admin/reviews', icon: <MessageSquare size={20} />, label: 'Đánh giá' },
    { path: '/admin/contacts', icon: <Mail size={20} />, label: 'Quản lý liên hệ' },
    { path: '/admin/notifications', icon: <BellRing size={20} />, label: 'Quản lý thông báo' },
    { path: '/admin/profile', icon: <UserCircle size={20} />, label: 'Thông tin cá nhân' },
    { path: '/admin/policies', icon: <ScrollText size={20} />, label: 'Điều khoản & bảo mật' }
  ];

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <span className="admin-sidebar-brand-icon">
            <LayoutDashboard size={20} />
          </span>
          <h4>ARENAHUB ADMIN</h4>
        </div>

        <nav className="admin-sidebar-menu" aria-label="Admin navigation">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`admin-sidebar-link ${location.pathname === item.path ? 'active-menu' : ''}`}
            >
              <span className="admin-sidebar-link-icon">{item.icon}</span>
              <span className="admin-sidebar-link-text">{item.label}</span>
            </Link>
          ))}

          <button onClick={handleLogout} className="admin-sidebar-logout">
            <LogOut size={19} />
            <span>Đăng xuất</span>
          </button>
        </nav>
      </aside>

      <main className="admin-main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
