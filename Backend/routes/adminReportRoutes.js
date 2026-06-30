const express = require('express');
const router = express.Router();
const { getRevenueReport } = require('../controllers/revenueReportController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/reports/revenue', protect, adminOnly, getRevenueReport);

module.exports = router;
