// File: Backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();

// Import đầy đủ các controller bao gồm googleLogin
const { 
    registerUser, 
    loginUser, 
    getAllUsers, 
    updateUser, 
    deleteUser, 
    createUser,
    googleLogin 
} = require('../controllers/userController');

// Import middleware bảo mật (đảm bảo đường dẫn middlewares có chữ 's')
const { protect, adminOnly } = require('../middlewares/authMiddleware');

// Route công khai
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google-login', googleLogin);

// Route cần bảo mật
// Cập nhật thông tin cá nhân (User tự cập nhật)
router.put('/:id', protect, updateUser);

// Các route quản trị (Chỉ dành cho Admin/Super Admin)
router.get('/', protect, adminOnly, getAllUsers);
router.post('/', protect, adminOnly, createUser);
router.delete('/:id', protect, adminOnly, deleteUser);

module.exports = router;