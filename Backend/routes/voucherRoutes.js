const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.post('/validate', protect, voucherController.validateVoucher);
router.get('/check', protect, voucherController.checkVoucher);

router.get('/', protect, adminOnly, voucherController.getAllVouchers);
router.post('/', protect, adminOnly, voucherController.createVoucher);
router.put('/:id', protect, adminOnly, voucherController.updateVoucher);
router.delete('/:id', protect, adminOnly, voucherController.deleteVoucher);

module.exports = router;
