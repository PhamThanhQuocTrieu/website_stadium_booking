const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middlewares/authMiddleware');
const { 
    getServices, 
    createService, 
    updateService, 
    deleteService, 
    toggleServiceStatus 
} = require('../controllers/serviceController');

// Debug: Đảm bảo các hàm controller đã được nạp đúng
if (!getServices) console.error("LỖI: getServices không được export!");
if (!createService) console.error("LỖI: createService không được export!");
if (!updateService) console.error("LỖI: updateService không được export!");
if (!deleteService) console.error("LỖI: deleteService không được export!");
if (!toggleServiceStatus) console.error("LỖI: toggleServiceStatus không được export!");

// Route lấy danh sách dịch vụ (Ai cũng xem được)
router.get('/', getServices);

// Các route quản lý dịch vụ (Chỉ dành cho Admin)
router.post('/', protect, admin, createService);
router.put('/:id', protect, admin, updateService);
router.delete('/:id', protect, admin, deleteService);
router.patch('/:id/status', protect, admin, toggleServiceStatus);

module.exports = router;