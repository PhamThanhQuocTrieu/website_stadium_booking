const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const {
  getAdminBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerActive,
  getHomeBanners
} = require('../controllers/bannerController');

router.get('/home', getHomeBanners);

router.get('/', protect, adminOnly, getAdminBanners);
router.post('/', protect, adminOnly, createBanner);
router.put('/:id', protect, adminOnly, updateBanner);
router.delete('/:id', protect, adminOnly, deleteBanner);
router.patch('/:id/toggle-active', protect, adminOnly, toggleBannerActive);

module.exports = router;
