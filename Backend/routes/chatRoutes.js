const express = require('express');
const {
  closeConversation,
  createConversationMessage,
  createUserMessage,
  getConversations,
  getMessages,
  getMyConversation,
  markDelivered,
  markRead,
  reopenConversation
} = require('../controllers/chatController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/conversations', protect, adminOnly, getConversations);
router.get('/conversations/my', protect, getMyConversation);
router.get('/conversations/:id/messages', protect, getMessages);
router.post('/messages', protect, createUserMessage);
router.post('/conversations/:id/messages', protect, createConversationMessage);
router.put('/conversations/:id/read', protect, markRead);
router.put('/conversations/:id/delivered', protect, markDelivered);
router.put('/conversations/:id/close', protect, adminOnly, closeConversation);
router.put('/conversations/:id/reopen', protect, adminOnly, reopenConversation);

module.exports = router;
