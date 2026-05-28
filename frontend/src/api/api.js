import axios from 'axios';

// Tạo instance api với baseURL
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Interceptor xử lý request
api.interceptors.request.use(
  (config) => {
    // Lấy token từ localStorage
    const token = localStorage.getItem('userToken');
    
    // Nếu có token, thêm vào header Authorization
    if (token) {
      // Đảm bảo dùng 'Bearer ' (có khoảng trắng)
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Thêm Content-Type mặc định nếu là JSON
    config.headers['Content-Type'] = 'application/json';
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// [BỔ SUNG QUAN TRỌNG] Thêm Interceptor xử lý phản hồi để phát hiện lỗi Token hết hạn ngay lập tức
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Nếu server trả về 401, tức là token hết hạn hoặc không hợp lệ
    if (error.response && error.response.status === 401) {
      // Có thể xóa token cũ và redirect về login nếu cần
      console.error("Token hết hạn hoặc không hợp lệ, cần đăng nhập lại!");
      // localStorage.removeItem('userToken');
      // window.location.href = '/login'; 
    }
    return Promise.reject(error);
  }
);

export default api;