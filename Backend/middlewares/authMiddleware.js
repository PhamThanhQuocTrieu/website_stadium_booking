const jwt = require('jsonwebtoken');

exports.protect = (req, res, next) => {
    let token = req.headers.authorization || req.headers.Authorization;

    if (token && token.toLowerCase().startsWith('bearer ')) {
        try {
            token = token.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Lưu thông tin user vào req
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

// Hàm logic gốc
exports.adminOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Vui lòng đăng nhập!' });
    }

    const role = String(req.user.role || '').toLowerCase();
    if (role === 'admin' || role === 'super admin') {
        next();
    } else {
        return res.status(403).json({ message: 'Bạn không có quyền truy cập trang quản trị!' });
    }
};

// 🌟 ĐỒNG BỘ: Xuất khẩu 'admin' để các file Route nhận diện được
exports.admin = exports.adminOnly;
