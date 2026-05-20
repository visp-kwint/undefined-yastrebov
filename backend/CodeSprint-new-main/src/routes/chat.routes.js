const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'docmind-secret-key-change-in-production';

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Невалидный токен' });
  }
}

router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { userId: req.userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' }
    });
    res.json({ sessions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/sessions', requireAuth, async (req, res) => {
  try {
    const { title } = req.body;
    const session = await prisma.chatSession.create({
      data: { title: title || 'Новый чат', userId: req.userId }
    });
    res.json({ session });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/sessions/:id/messages', requireAuth, async (req, res) => {
  try {
    const { sender, text, isHtml } = req.body;
    const message = await prisma.chatMessage.create({
      data: { sessionId: req.params.id, sender, text, isHtml: isHtml || false }
    });
    await prisma.chatSession.update({
      where: { id: req.params.id },
      data: { updatedAt: new Date() }
    });
    res.json({ message });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const { title } = req.body;
    const session = await prisma.chatSession.update({
      where: { id: req.params.id },
      data: { title }
    });
    res.json({ session });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    await prisma.chatSession.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/sessions/:id/documents', requireAuth, async (req, res) => {
  try {
    const { documentIds } = req.body;
    const session = await prisma.chatSession.update({
      where: { id: req.params.id },
      data: { documentIds: JSON.stringify(documentIds || []) }
    });
    res.json({ session });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;