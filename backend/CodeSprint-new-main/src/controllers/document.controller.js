const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'docmind-secret-key-change-in-production';

function getUserIdFromReq(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  try {
    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET);
    return decoded.userId;
  } catch { return null; }
}

const getAllDocuments = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Требуется авторизация' });

    const documents = await prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: documents });
  } catch (error) {
    console.error('Ошибка получения документов:', error);
    res.status(500).json({ success: false, message: 'Ошибка при получении документов' });
  }
};

const getDocument = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Требуется авторизация' });

    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId }
    });
    if (!document) return res.status(404).json({ success: false, message: 'Документ не найден' });
    res.json({ success: true, data: document });
  } catch (error) {
    console.error('Ошибка получения документа:', error);
    res.status(500).json({ success: false, message: 'Ошибка при получении документа' });
  }
};

module.exports = { getAllDocuments, getDocument };