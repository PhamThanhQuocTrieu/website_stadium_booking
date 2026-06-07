const express = require('express');
const router = express.Router();
const {
  createVnpayPayment,
  handleVnpayReturn,
  handleVnpayIpn
} = require('../controllers/paymentController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/vnpay/create', protect, createVnpayPayment);
router.post('/create-vnpay-url', protect, createVnpayPayment);
router.get('/vnpay/return', handleVnpayReturn);
router.get('/vnpay/ipn', handleVnpayIpn);

module.exports = router;
