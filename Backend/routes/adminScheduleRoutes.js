const express = require('express');
const router = express.Router();
const {
  getSchedule,
  rescheduleBooking,
  checkRecurringBooking,
  createRecurringBooking,
  listRecurringBookings,
  getRecurringBookingDetail,
  cancelRecurringBooking,
  updateFutureRecurringBooking
} = require('../controllers/adminScheduleController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/schedule', protect, adminOnly, getSchedule);
router.patch('/bookings/:id/reschedule', protect, adminOnly, rescheduleBooking);
router.post('/recurring-bookings/check', protect, adminOnly, checkRecurringBooking);
router.post('/recurring-bookings', protect, adminOnly, createRecurringBooking);
router.get('/recurring-bookings', protect, adminOnly, listRecurringBookings);
router.get('/recurring-bookings/:id', protect, adminOnly, getRecurringBookingDetail);
router.patch('/recurring-bookings/:id/cancel', protect, adminOnly, cancelRecurringBooking);
router.patch('/recurring-bookings/:id/update-future', protect, adminOnly, updateFutureRecurringBooking);

module.exports = router;
