import React from 'react';
import { Navigate } from 'react-router-dom';

const AdminRoute = ({ children }) => {
  // Lấy thông tin user từ localStorage
  const userInfo = JSON.parse(localStorage.getItem('userInfo'));
  
  // Kiểm tra: Phải đăng nhập VÀ role phải là 'admin' hoặc 'Super Admin'
  const isAdmin = userInfo && (userInfo.role === 'admin' || userInfo.role === 'Super Admin');

  return isAdmin ? children : <Navigate to="/" replace />;
};

export default AdminRoute;