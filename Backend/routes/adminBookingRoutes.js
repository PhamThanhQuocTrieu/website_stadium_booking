const express = require('express');
const router = express.Router();
const {
  approveCancelBooking,
  rejectCancelBooking
} = require('../controllers/bookingController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.patch('/:id/approve-cancel', protect, adminOnly, approveCancelBooking);
router.patch('/:id/reject-cancel', protect, adminOnly, rejectCancelBooking);

module.exports = router;
