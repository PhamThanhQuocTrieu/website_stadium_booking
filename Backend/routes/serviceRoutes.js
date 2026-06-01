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

// Kiểm tra: Nếu 1 trong các hàm này là undefined, code sẽ lỗi ngay tại đây khi load
if (!createService) console.error("LỖI: createService không được export từ controller!");

router.get('/', getServices);
router.post('/', protect, admin, createService);
router.put('/:id', protect, admin, updateService);
router.delete('/:id', protect, admin, deleteService);
router.patch('/:id/status', protect, admin, toggleServiceStatus);

module.exports = router;