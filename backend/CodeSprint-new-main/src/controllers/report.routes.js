
const express = require('express');
const router = express.Router();
const { generateReport } = require('../controllers/report.controller');

// POST /api/reports/generate — генерация отчёта с диаграммами и файлами
router.post('/generate', generateReport);

module.exports = router;