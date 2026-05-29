const express = require('express');
const router = express.Router();
const { userGetFields, userGetFieldById } = require('../controllers/userFieldController');

// Khách hàng cần xem sân không cần đăng nhập
router.get('/', userGetFields); 
router.get('/:id', userGetFieldById);

module.exports = router;