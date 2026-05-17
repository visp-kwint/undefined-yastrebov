const express = require('express');
const { askQuestion } = require('../controllers/ask.controller');

const router = express.Router();

router.post('/', askQuestion);

module.exports = router;