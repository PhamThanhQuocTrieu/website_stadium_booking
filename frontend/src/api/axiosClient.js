import axios from 'axios';

const axiosClient = axios.create({
    baseURL: 'http://localhost:5000/api', // Đảm bảo đúng port và có /api
    headers: { 'Content-Type': 'application/json' }
});

// Thêm interceptor để đính kèm Token tự động
axiosClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('userToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default axiosClient;