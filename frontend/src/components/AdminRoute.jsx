import React from 'react';
import { Navigate } from 'react-router-dom';

const AdminRoute = ({ children }) => {
  // Lấy thông tin user từ localStorage
  let userInfo = null;
  try {
    userInfo = JSON.parse(localStorage.getItem('userInfo'));
  } catch {
    userInfo = null;
  }
  
  // Kiểm tra: Phải đăng nhập VÀ role phải là 'admin' hoặc 'Super Admin'
  const role = String(userInfo?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'super admin';

  return isAdmin ? children : <Navigate to="/" replace />;
};

export default AdminRoute;
