const express = require('express');
const router = express.Router();
const { userGetFields, userGetFieldById } = require('../controllers/userFieldController');

router.get('/', userGetFields);
router.get('/:id', userGetFieldById);

module.exports = router;
