const express = require('express');
const router = express.Router();
const {
  getBookingStatus,
  reserveSlots,
  getBookingById,
  getMyBookings,
  updateBookingInfo,
  adminGetBookings
} = require('../controllers/bookingController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/fields/:fieldId/booking-status', getBookingStatus);
router.post('/reserve', protect, reserveSlots);
router.get('/my-bookings', protect, getMyBookings);
router.get('/admin/list', protect, adminOnly, adminGetBookings);
router.get('/:id', protect, getBookingById);
router.put('/:id/update-info', protect, updateBookingInfo);

module.exports = router;
