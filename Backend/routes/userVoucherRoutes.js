const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { getMyVouchers } = require('../controllers/voucherController');

router.get('/vouchers', protect, getMyVouchers);

module.exports = router;
