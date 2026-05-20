const documentService = require('../services/document.service');
const retrievalService = require('../services/retrieval.service');
const AppError = require('../utils/AppError');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'docmind-secret-key-change-in-production';

function getUserIdFromReq(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  try {
    return jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET).userId;
  } catch {
    return null;
  }
}

const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('Файл не был загружен', 400);

    const userId = getUserIdFromReq(req);
    const document = await documentService.processUploadedFile(req.file, userId);

    if (document.extractedText && document.extractedText.trim()) {
      try {
        retrievalService.indexDocument(document.extractedText, document.id);
      } catch (e) {
        console.warn('[upload.controller] indexDocument warn:', e.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Файл успешно загружен',
      id: document.id,
      originalName: document.originalName,
      size: document.size,
      status: document.status,
      extractedText: document.extractedText
        ? document.extractedText.substring(0, 300)
        : null
    });
  } catch (error) {
    console.error('[upload.controller] Ошибка:', error);
    next(error);
  }
};

module.exports = { uploadDocument };