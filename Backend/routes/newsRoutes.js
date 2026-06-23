const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const {
  createNews,
  deleteNews,
  getAdminNews,
  getPublishedNews,
  getPublishedNewsDetail,
  updateNews
} = require('../controllers/newsController');

router.get('/admin/all', protect, adminOnly, getAdminNews);
router.post('/admin', protect, adminOnly, createNews);
router.put('/admin/:id', protect, adminOnly, updateNews);
router.delete('/admin/:id', protect, adminOnly, deleteNews);

router.get('/', getPublishedNews);
router.get('/:slugOrId', getPublishedNewsDetail);

module.exports = router;
