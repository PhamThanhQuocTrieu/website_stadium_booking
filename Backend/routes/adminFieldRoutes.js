const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const { 
    adminGetAllFields, adminCreateField, adminUpdateField, adminDeleteField, adminGetFieldById, adminToggleFieldMaintenance
} = require('../controllers/fieldController');

// 🛡️ Bắt buộc Admin
router.use(protect, adminOnly);

router.get('/', adminGetAllFields);
router.get('/:id', adminGetFieldById);
router.post('/', adminCreateField);
router.patch('/:id/maintenance', adminToggleFieldMaintenance);
router.put('/:id', adminUpdateField);
router.delete('/:id', adminDeleteField);

module.exports = router;
