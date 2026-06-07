const express = require('express');
const router = express.Router();
const {
  createReview,
  getFieldReviews,
  getServiceReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  adminGetReviews
} = require('../controllers/reviewController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/field/:fieldId', getFieldReviews);
router.get('/service/:serviceId', getServiceReviews);
router.get('/my-reviews', protect, getMyReviews);
router.get('/admin', protect, adminOnly, adminGetReviews);
router.post('/', protect, createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;
