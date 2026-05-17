const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { generateReport } = require('../controllers/report.controller');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

// POST /api/reports/generate
router.post('/generate', generateReport);

// GET /api/reports — список отчётов
router.get('/', async (req, res) => {
    try {
        const reports = await prisma.report.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json({ success: true, reports });
    } catch (error) {
        console.error('Reports list error:', error);
        res.status(500).json({ success: false, error: 'Ошибка получения списка отчётов' });
    }
});

// GET /api/reports/:filename — отдаём файл из public/reports
router.get('/:filename', async (req, res) => {
    try {
        const filePath = path.join(__dirname, '../../public/reports', req.params.filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Файл не найден' });
        }

        res.download(filePath);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Ошибка скачивания' });
    }
});

module.exports = router;