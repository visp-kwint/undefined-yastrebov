const express = require('express');
const { generateSummary } = require('../controllers/summary.controller');

const router = express.Router();

router.post('/', generateSummary);

module.exports = router;