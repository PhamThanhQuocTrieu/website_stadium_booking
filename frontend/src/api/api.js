import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Interceptor xử lý request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['Content-Type'] = 'application/json';
    return config;
  },
  (error) => Promise.reject(error)
);

// [HOÀN THIỆN] Xử lý phản hồi để tự động đăng xuất khi Token hết hạn
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Kiểm tra nếu lỗi là 401 (Unauthorized) - Token hết hạn hoặc không hợp lệ
    if (error.response && error.response.status === 401) {
      console.warn("Token hết hạn, thực hiện đăng xuất...");
      
      // 1. Xóa dữ liệu xác thực
      localStorage.removeItem('userToken');
      localStorage.removeItem('userInfo');
      
      // 2. Chuyển hướng về trang login
      // Sử dụng window.location để refresh lại hoàn toàn ứng dụng, xóa sạch state cũ
      window.location.href = '/login'; 
    }
    
    // Nếu là lỗi khác (ví dụ 403, 404, 500), vẫn trả lỗi về cho nơi gọi API xử lý
    return Promise.reject(error);
  }
);

export default api;