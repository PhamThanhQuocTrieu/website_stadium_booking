const express = require('express');
const router = express.Router();
const {
  getBookingStatus,
  reserveSlots,
  joinBookingWaitlist,
  getMyBookingWaitlist,
  getBookingById,
  getMyBookings,
  updateBookingInfo,
  cancelBooking,
  requestCancelBooking,
  adminGetBookings
} = require('../controllers/bookingController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/fields/:fieldId/booking-status', getBookingStatus);
router.post('/reserve', protect, reserveSlots);
router.post('/waitlist', protect, joinBookingWaitlist);
router.get('/waitlist', protect, getMyBookingWaitlist);
router.get('/my-bookings', protect, getMyBookings);
router.get('/admin/list', protect, adminOnly, adminGetBookings);
router.get('/:id', protect, getBookingById);
router.put('/:id/update-info', protect, updateBookingInfo);
router.patch('/:id/cancel', protect, cancelBooking);
router.patch('/:id/request-cancel', protect, requestCancelBooking);

module.exports = router;
