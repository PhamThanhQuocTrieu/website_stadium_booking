// File: Backend/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

exports.protect = (req, res, next) => {
    // 1. Kiểm tra cả authorization (thường) và Authorization (viết hoa)
    let token = req.headers.authorization || req.headers.Authorization;

    // 2. Kiểm tra nếu token tồn tại và bắt đầu bằng "Bearer" (không phân biệt hoa thường)
    if (token && token.toLowerCase().startsWith('bearer ')) {
        try {
            // Tách token sau chữ "Bearer "
            token = token.split(' ')[1];
            
            // Giải mã token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Lưu thông tin user vào req để các controller/middleware sau sử dụng
            req.user = decoded; 
            next();
        } catch (error) {
            console.error("Token verification error:", error.message);
            return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
        }
    } else {
        return res.status(401).json({ message: 'Không có token, vui lòng đăng nhập' });
    }
};

exports.adminOnly = (req, res, next) => {
    const role = req.user?.role;

    if (role === 'admin' || role === 'Super Admin') {
        next();
    } else {
        return res.status(403).json({ message: 'Bạn không có quyền truy cập trang quản trị!' });
    }
};