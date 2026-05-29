import React, { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import axios from 'axios';
import Navigation from './components/Navbar';
import HomePage from './pages/HomePage';
import FieldsPage from './pages/FieldsPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import BookingPage from './pages/BookingPage';
import FieldDetailPage from './pages/FieldDetailPage';
import Footer from './components/Footer';
import PaymentPage from './pages/PaymentPage';
import UserProfile from './pages/UserProfile'; 

// IMPORT CÁC TRANG ADMIN
import AdminLayout from './pages/Admin/AdminLayout';
import Dashboard from './pages/Admin/Dashboard';
import FieldManager from './pages/Admin/FieldManager';
import AddFieldPage from './pages/Admin/AddFieldPage';      // 🌟 MỚI: Trang thêm sân
import UpdateFieldPage from './pages/Admin/UpdateFieldPage'; // 🌟 MỚI: Trang sửa sân
import BookingCalendar from './pages/Admin/BookingCalendar';
import UserManager from './pages/Admin/UserManager'; 
import AdminProfile from './pages/Admin/Profile'; 
import './App.css';

// 🛡️ BẢO VỆ ROUTE: Chỉ cho phép 'admin' truy cập
const AdminRoute = ({ children }) => {
  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    const isAdmin = userInfo && userInfo.role === 'admin'; 
    return isAdmin ? children : <Navigate to="/" replace />;
  } catch (e) {
    return <Navigate to="/login" replace />;
  }
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Interceptor giúp tự động đính kèm token hoặc xử lý lỗi 401 tập trung
    const interceptor = axios.interceptors.response.use(
      (response) => response, 
      (error) => {
        if (error.response && error.response.status === 401) {
          console.warn("Phiên đăng nhập hết hạn hoặc không có quyền!");
          localStorage.clear(); // Xóa sạch dữ liệu cũ để tránh lỗi "User không tồn tại"
          navigate('/login');
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [navigate]);

  const isAuthPage = ['/register', '/login'].includes(location.pathname) || location.pathname.startsWith('/booking');
  const isAdminPage = location.pathname.startsWith('/admin');
  const showHeaderFooter = !isAuthPage && !isAdminPage;

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {showHeaderFooter && <Navigation />}

      <main style={{ paddingTop: showHeaderFooter ? '70px' : '0px', flex: '1 0 auto' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/fields" element={<FieldsPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/booking/:id" element={<BookingPage />} />
          <Route path="/field-detail/:id" element={<FieldDetailPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/profile" element={<UserProfile />} />
          
          {/* Cấu trúc Admin mới */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="fields" element={<FieldManager />} />
            <Route path="addField" element={<AddFieldPage />} />        {/* Route thêm sân */}
            <Route path="updateField/:id" element={<UpdateFieldPage />} /> {/* Route sửa sân */}
            <Route path="calendar" element={<BookingCalendar />} />
            <Route path="bookings" element={<div>Quản lý đơn đặt sân</div>} />
            <Route path="users" element={<UserManager />} /> 
            <Route path="profile" element={<AdminProfile />} />
            <Route path="payments" element={<div>Quản lý thanh toán</div>} />
            <Route path="reports" element={<div>Báo cáo doanh thu</div>} />
          </Route>
        </Routes>
      </main>

      {showHeaderFooter && <Footer />}
    </div>
  );
}

export default App;