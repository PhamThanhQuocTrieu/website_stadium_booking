import React, { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import axios from 'axios';
import Navigation from './components/Navbar';
import HomePage from './pages/HomePage';
import FieldsPage from './pages/FieldsPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import BookingPage from './pages/BookingPage';
import FieldDetailPage from './pages/FieldDetailPage';
import Footer from './components/Footer';
import PaymentPage from './pages/PaymentPage';
import VnpayReturnPage from './pages/VnpayReturnPage';
import UserProfile from './pages/UserProfile';
import MyBookingsPage from './pages/MyBookingsPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import ContactPage from './pages/ContactPage';
import NotificationsPage from './pages/NotificationsPage';
import MyVouchersPage from './pages/MyVouchersPage';
import NewsPage from './pages/NewsPage';
import NewsDetailPage from './pages/NewsDetailPage';
import UserChatBox from './components/chat/UserChatBox';

import AdminLayout from './pages/Admin/AdminLayout';
import Dashboard from './pages/Admin/Dashboard';
import FieldManager from './pages/Admin/FieldManager';
import AddFieldPage from './pages/Admin/AddFieldPage';
import UpdateFieldPage from './pages/Admin/UpdateFieldPage';
import BookingCalendar from './pages/Admin/BookingCalendar';
import ScheduleManager from './pages/Admin/ScheduleManager';
import BookingManager from './pages/Admin/BookingManager';
import UserManager from './pages/Admin/UserManager';
import AdminProfile from './pages/Admin/Profile';
import VoucherManager from './pages/Admin/VoucherManager';
import BannerManager from './pages/Admin/BannerManager';
import ServiceManager from './pages/Admin/ServiceManager';
import ReviewManager from './pages/Admin/ReviewManager';
import AdminPolicyManager from './pages/Admin/AdminPolicyManager';
import ContactManager from './pages/Admin/ContactManager';
import AdminNotificationManager from './pages/Admin/AdminNotificationManager';
import ChatManager from './pages/Admin/ChatManager';
import NewsManager from './pages/Admin/NewsManager';
import RevenueReport from './pages/Admin/RevenueReport';

import './App.css';

const AdminRoute = ({ children }) => {
  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    const role = String(userInfo?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'super admin';
    return isAdmin ? children : <Navigate to="/" replace />;
  } catch {
    return <Navigate to="/login" replace />;
  }
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          localStorage.removeItem('userToken');
          localStorage.removeItem('userInfo');
          window.dispatchEvent(new Event('authChanged'));
          navigate('/login');
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [navigate]);

  const isAuthPage = ['/register', '/login', '/forgot-password'].includes(location.pathname) || location.pathname.startsWith('/booking');
  const isAdminPage = location.pathname.startsWith('/admin');
  const isNewsPage = location.pathname.startsWith('/news');
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
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/booking/:id" element={<BookingPage />} />
          <Route path="/field-detail/:id" element={<FieldDetailPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/payment/vnpay-return" element={<VnpayReturnPage />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/my-bookings" element={<MyBookingsPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/my-vouchers" element={<MyVouchersPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/news/:slug" element={<NewsDetailPage />} />

          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="fields" element={<FieldManager />} />
            <Route path="addField" element={<AddFieldPage />} />
            <Route path="updateField/:id" element={<UpdateFieldPage />} />
            <Route path="calendar" element={<BookingCalendar />} />
            <Route path="schedule-manager" element={<ScheduleManager />} />
            <Route path="bookings" element={<BookingManager />} />
            <Route path="users" element={<UserManager />} />
            <Route path="profile" element={<AdminProfile />} />
            <Route path="vouchers" element={<VoucherManager />} />
            <Route path="banners" element={<BannerManager />} />
            <Route path="services" element={<ServiceManager />} />
            <Route path="reviews" element={<ReviewManager />} />
            <Route path="policies" element={<AdminPolicyManager />} />
            <Route path="contacts" element={<ContactManager />} />
            <Route path="notifications" element={<AdminNotificationManager />} />
            <Route path="news" element={<NewsManager />} />
            <Route path="chats" element={<ChatManager />} />
            <Route path="payments" element={<BookingManager />} />
            <Route path="reports" element={<RevenueReport />} />
          </Route>
        </Routes>
      </main>

      {!isAdminPage && !isNewsPage && <UserChatBox />}
      {showHeaderFooter && <Footer />}
    </div>
  );
}

export default App;
