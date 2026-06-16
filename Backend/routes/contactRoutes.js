const express = require('express');
const router = express.Router();
const {
  createContact,
  deleteContact,
  getContactById,
  getContacts,
  replyContact,
  updateContactStatus
} = require('../controllers/contactController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.post('/', createContact);
router.get('/', protect, adminOnly, getContacts);
router.get('/:id', protect, adminOnly, getContactById);
router.patch('/:id/status', protect, adminOnly, updateContactStatus);
router.patch('/:id/reply', protect, adminOnly, replyContact);
router.delete('/:id', protect, adminOnly, deleteContact);

module.exports = router;
