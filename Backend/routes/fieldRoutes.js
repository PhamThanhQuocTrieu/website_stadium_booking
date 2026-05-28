// File: Backend/routes/fieldRoutes.js
const express = require('express');
const router = express.Router();
const { 
    adminGetAllFields, 
    adminCreateField, 
    adminUpdateField, 
    adminDeleteField 
} = require('../controllers/fieldController');

// Đảm bảo các route này khớp với đường dẫn bạn gọi trong axiosClient
// Nếu trong axiosClient bạn gọi '/admin/fields', thì ở đây router phải là:
router.get('/', adminGetAllFields); // Khi gắn router này vào app.use('/api/admin/fields', ...)
router.post('/', adminCreateField);
router.put('/:id', adminUpdateField);
router.delete('/:id', adminDeleteField);

module.exports = router;