// File: Backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();

// Import các controller và middleware bảo mật
const { 
    registerUser, loginUser, getAllUsers, updateUser, deleteUser, createUser 
} = require('../controllers/userController');

const { protect, adminOnly } = require('../middlewares/authMiddleware');

// Route công khai (Ai cũng truy cập được)
router.post('/register', registerUser);
router.post('/login', loginUser);

// Route yêu cầu phải đăng nhập mới được dùng
router.put('/:id', protect, updateUser);

// Route yêu cầu phải đăng nhập VÀ có quyền Admin mới được dùng
router.get('/', protect, adminOnly, getAllUsers);
router.post('/', protect, adminOnly, createUser);
router.delete('/:id', protect, adminOnly, deleteUser);

module.exports = router;