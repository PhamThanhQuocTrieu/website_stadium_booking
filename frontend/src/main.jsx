import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google'; // 1. Import thêm Provider này

// Import CSS của Bootstrap
import 'bootstrap/dist/css/bootstrap.min.css';

// Import Bootstrap Icons
import 'bootstrap-icons/font/bootstrap-icons.css';

// Import file CSS riêng
import './index.css';

// 2. Client ID bạn đã lấy từ Google Cloud Console
const GOOGLE_CLIENT_ID = "95976995521-i3on7gb63ceeqs9hdd25nmuev2sepmi4.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 3. Bọc GoogleOAuthProvider ở lớp ngoài cùng hoặc bên trong BrowserRouter */}
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>
);