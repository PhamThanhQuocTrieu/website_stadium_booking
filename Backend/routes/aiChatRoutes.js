const express = require('express');
const { clearHistory, getHistory, sendMessage } = require('../controllers/aiChatController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/send', protect, sendMessage);
router.get('/history', protect, getHistory);
router.delete('/clear', protect, clearHistory);

module.exports = router;
