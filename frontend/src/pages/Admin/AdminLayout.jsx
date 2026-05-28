// File: Frontend/src/pages/Admin/AdminLayout.jsx
import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MapPinned, CalendarDays, Users, LogOut, UserCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import '../../styles/admin/layout.css';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    Swal.fire({
      title: 'Đăng xuất?',
      text: "Bạn có chắc chắn muốn rời khỏi trang quản trị?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Đăng xuất'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('token'); // Xóa token
        localStorage.removeItem('user');  // Xóa thông tin user nếu có
        navigate('/login');              // Chuyển về trang đăng nhập
      }
    });
  };

  const menuItems = [
    { path: '/admin', icon: <LayoutDashboard size={20}/>, label: 'Dashboard' },
    { path: '/admin/fields', icon: <MapPinned size={20}/>, label: 'Quản lý sân' },
    { path: '/admin/bookings', icon: <CalendarDays size={20}/>, label: 'Đơn đặt sân' },
    { path: '/admin/users', icon: <Users size={20}/>, label: 'Người dùng' },
    { path: '/admin/profile', icon: <UserCircle size={20}/>, label: 'Thông tin cá nhân' },
  ];

  return (
    <div className="d-flex" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <div className="bg-dark text-white p-3 position-fixed sidebar">
        <h4 className="text-success fw-bold mb-5 text-center">ArenaHub Admin</h4>
        <div className="nav flex-column">
          {menuItems.map((item) => (
            <Link key={item.path} to={item.path} className={`nav-link text-white d-flex align-items-center gap-3 mb-2 ${location.pathname === item.path ? 'active-menu' : ''}`}>
              {item.icon} {item.label}
            </Link>
          ))}
        </div>
        <div className="logout-fixed">
          <button onClick={handleLogout} className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2">
            <LogOut size={18}/> Đăng xuất
          </button>
        </div>
      </div>
      <div style={{ marginLeft: '260px', width: 'calc(100% - 260px)', padding: '30px' }}>
        <Outlet />
      </div>
    </div>
  );
};
export default AdminLayout;