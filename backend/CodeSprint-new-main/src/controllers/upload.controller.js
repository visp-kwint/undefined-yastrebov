const documentService = require('../services/document.service');
const retrievalService = require('../services/retrieval.service');
const AppError = require('../utils/AppError');

const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('Файл не был загружен', 400);
    }

    const document = await documentService.processUploadedFile(req.file);

    if (document.extractedText && document.extractedText.trim()) {
      retrievalService.indexDocument(document.extractedText, document.id);
      console.log(`Документ ${document.id} проиндексирован`);
    }

    res.status(201).json({
      success: true,
      message: 'Файл успешно загружен',
      id:           document.id,
      originalName: document.originalName,
      size:         document.size,
      status:       document.status,
      extractedText: document.extractedText
        ? document.extractedText.substring(0, 300)
        : null
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadDocument };
