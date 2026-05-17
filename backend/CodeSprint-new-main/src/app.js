const express = require('express');
const cors = require('cors');
const path = require('path');
require('express-async-errors');

const uploadRoutes = require('./routes/upload.routes');
const documentRoutes = require('./routes/document.routes');
const askRoutes = require('./routes/ask.routes');
const summaryRoutes = require('./routes/summary.routes');
const testRoutes = require('./routes/test.routes');
const authRoutes = require('./routes/auth.routes');
const chatRoutes = require('./routes/chat.routes');
const reportRoutes = require('./routes/report.routes');
const commandRoutes = require('./routes/command.routes');

const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ask', askRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/test', testRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/commands', commandRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handler — ВСЕГДА последний!
app.use(errorMiddleware);

module.exports = app;