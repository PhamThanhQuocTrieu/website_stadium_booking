import axios from 'axios';

const axiosClient = axios.create({
    baseURL: 'http://localhost:5000/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor cho Request: Gắn Token
axiosClient.interceptors.request.use(
    (config) => {
        let token = localStorage.getItem('userToken');
        const userInfoRaw = localStorage.getItem('userInfo');
        if (userInfoRaw) {
            try {
                const userInfo = JSON.parse(userInfoRaw);
                token = userInfo.token || token;
            } catch (e) {
                console.error("Lỗi parse token từ localStorage", e);
            }
        }
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor cho Response: Chỉ đăng xuất nếu lỗi 401 thuộc về server của mình
axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {
        // Kiểm tra xem lỗi có phải từ server của bạn không (localhost:5000)
        const isOurServer = error.config?.baseURL?.includes('localhost:5000');
        
        if (error.response?.status === 401 && isOurServer) {
            localStorage.clear();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default axiosClient;
