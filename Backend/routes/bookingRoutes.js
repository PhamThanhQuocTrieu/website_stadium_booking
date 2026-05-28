// File: Backend/routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
// Thêm hàm getBookingById vào danh sách import
const { getBookingStatus, reserveSlots, getBookingById } = require('../controllers/bookingController');
const { protect } = require('../middlewares/authMiddleware'); 

// Link: GET http://localhost:5000/api/bookings/fields/:fieldId/booking-status
router.get('/fields/:fieldId/booking-status', getBookingStatus);

// Link: POST http://localhost:5000/api/bookings/reserve
router.post('/reserve', protect, reserveSlots);

// 🌟 THÊM ROUTE NÀY: GET http://localhost:5000/api/bookings/:id
router.get('/:id', protect, getBookingById);

module.exports = router;