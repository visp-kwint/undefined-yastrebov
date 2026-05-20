const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { extractTextFromWord } = require('./word.service');

// PDF
let extractTextFromPdf = null;
try {
  const pdfSvc = require('./pdf.service');
  extractTextFromPdf = pdfSvc.extractTextFromPdf || pdfSvc.default || pdfSvc;
  if (typeof extractTextFromPdf !== 'function') extractTextFromPdf = null;
} catch (e) {
  console.log('[document.service] PDF-сервис не подключён:', e.message);
}

// Excel
let extractTextFromExcel = null;
try {
  const xlsSvc = require('./excel.service');
  extractTextFromExcel = xlsSvc.extractTextFromExcel || xlsSvc.default || xlsSvc;
  if (typeof extractTextFromExcel !== 'function') extractTextFromExcel = null;
} catch (e) {
  console.log('[document.service] Excel-сервис не подключён:', e.message);
}

// OCR (изображения)
let extractTextFromImage = null;
try {
  const ocrSvc = require('./ocr.service');
  extractTextFromImage = ocrSvc.extractTextFromImage || ocrSvc.default || ocrSvc;
  if (typeof extractTextFromImage !== 'function') extractTextFromImage = null;
} catch (e) {
  console.log('[document.service] OCR-сервис не подключён:', e.message);
}

async function extractText(filePath, mimeType, originalName) {
  const ext = path.extname(originalName || filePath).toLowerCase();

  try {
    // DOCX
    if (
      ext === '.docx' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      if (typeof extractTextFromWord !== 'function') {
        throw new Error('extractTextFromWord не функция (проверь word.service.js)');
      }
      return (await extractTextFromWord(filePath)) || '';
    }

    // PDF
    if (ext === '.pdf' || mimeType === 'application/pdf') {
      if (extractTextFromPdf) return (await extractTextFromPdf(filePath)) || '';
      return '';
    }

    // Excel
    if (
      ['.xlsx', '.xls'].includes(ext) ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      if (extractTextFromExcel) return (await extractTextFromExcel(filePath)) || '';
      return '';
    }

    // TXT / CSV
    if (['.txt', '.csv'].includes(ext) || mimeType === 'text/plain' || mimeType === 'text/csv') {
      return fs.readFileSync(filePath, 'utf8');
    }

    // Изображения
    if (
      ['.jpg', '.jpeg', '.png'].includes(ext) ||
      mimeType === 'image/jpeg' ||
      mimeType === 'image/png'
    ) {
      if (extractTextFromImage) {
        console.log(`[document.service] Запуск OCR для ${originalName}...`);
        const result = await extractTextFromImage(filePath);
        console.log(`[document.service] OCR вернул ${(result || '').length} симв.`);
        return result || '';
      }
      console.warn('[document.service] OCR-сервис не доступен для изображения!');
      return '';
    }

    console.log('[document.service] Неизвестный тип файла:', ext, mimeType);
    return '';
  } catch (err) {
    console.error(`[document.service] Ошибка извлечения (${ext}):`, err.message);
    return '';
  }
}

/**
 * Сохраняет загруженный multer-файл в БД и извлекает текст.
 * Соответствует prisma-схеме (storedName, extension, extractedText@map text и т.д.)
 */
async function processUploadedFile(file, userId) {
  const filePath = file.path;
  const originalName = file.originalname;
  const mimeType = file.mimetype;
  const size = file.size;
  const ext = path.extname(originalName || '').toLowerCase().replace('.', '') || 'unknown';
  const storedName = file.filename || path.basename(filePath);

  let extractedText = '';
  let status = 'processed';
  let errorText = null;

  try {
    extractedText = await extractText(filePath, mimeType, originalName);
    if (!extractedText || !extractedText.trim()) {
      status = 'no_text';
    }
  } catch (e) {
    status = 'error';
    errorText = e.message;
  }

  const document = await prisma.document.create({
    data: {
      userId: userId || null,
      originalName,
      storedName,
      mimeType,
      extension: ext,
      size,
      filePath,
      extractedText,
      status,
      error: errorText
    }
  });

  console.log(
    `[document.service] Файл загружен: ${originalName} ` +
    `(${(size / 1024).toFixed(1)} KB), статус: ${status}, ` +
    `текста: ${(extractedText || '').length} симв., userId: ${userId || '-'}`
  );

  return document;
}

async function getDocuments(userId) {
  return prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
}

async function getDocumentById(id, userId) {
  return prisma.document.findFirst({ where: { id, userId } });
}

async function deleteDocument(id, userId) {
  const doc = await prisma.document.findFirst({ where: { id, userId } });
  if (!doc) return null;
  try {
    if (doc.filePath && fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath);
  } catch (e) {
    console.error('[document.service] Не удалось удалить файл:', e.message);
  }
  await prisma.document.delete({ where: { id } });
  return doc;
}

module.exports = {
  processUploadedFile, // ← главное имя, которое ждёт upload.controller
  uploadDocument: processUploadedFile, // алиас на всякий случай
  getDocuments,
  getDocumentById,
  deleteDocument,
  extractText
};