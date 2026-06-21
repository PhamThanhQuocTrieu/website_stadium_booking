const express = require('express');
const router = express.Router();
const { getAdminDashboard } = require('../controllers/dashboardController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/dashboard', protect, adminOnly, getAdminDashboard);

module.exports = router;
