const express = require('express');
const router = express.Router();
const {
  getPublicPolicy,
  getAllPolicies,
  updatePolicy
} = require('../controllers/policyController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/', protect, adminOnly, getAllPolicies);
router.put('/:id', protect, adminOnly, updatePolicy);
router.get('/:type', getPublicPolicy);

module.exports = router;
