const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');

// Đảm bảo bạn đã import đúng đường dẫn tới middleware
const { protect, adminOnly } = require('../middlewares/authMiddleware');

// Route Admin: Cần bảo vệ bằng middleware protect và adminOnly
router.get('/', protect, adminOnly, voucherController.getAllVouchers);
router.post('/', protect, adminOnly, voucherController.createVoucher);
router.put('/:id', protect, adminOnly, voucherController.updateVoucher);
router.delete('/:id', protect, adminOnly, voucherController.deleteVoucher);

// Route User kiểm tra mã: Ai cũng có thể kiểm tra (hoặc protect tùy nhu cầu)
router.get('/check', voucherController.checkVoucher);

module.exports = router;