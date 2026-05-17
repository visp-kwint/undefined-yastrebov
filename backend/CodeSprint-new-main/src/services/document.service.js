const path = require('path');
const prisma = require('./prisma.service');
const pdfService = require('./pdf.service');
const ocrService = require('./ocr.service');
const wordService = require('./word.service');
const excelService = require('./excel.service');
const AppError = require('../utils/AppError');

async function processUploadedFile(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  let extractedText = '';
  let status = 'processed';

  try {
    if (file.mimetype === 'application/pdf') {
      extractedText = await pdfService.extractTextFromPdf(file.path);
      if (!extractedText || extractedText.trim().length < 10) {
          console.log('PDF без текстового слоя — скан без OCR поддержки');
          extractedText = '';
          status = 'no_text';
      }
    } else if (
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/png'
    ) {
      extractedText = await ocrService.extractTextFromImage(file.path);
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      extractedText = await wordService.extractTextFromWord(file.path);
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel'
    ) {
      extractedText = await excelService.extractTextFromExcel(file.path);
    } else if (
      file.mimetype === 'text/plain' ||
      file.mimetype === 'text/csv'
    ) {
      const fs = require('fs');
      extractedText = fs.readFileSync(file.path, 'utf8');
    } else {
      throw new AppError('Неподдерживаемый тип файла', 400);
    }

    if (!extractedText || !extractedText.trim()) {
      extractedText = '';
    }
  } catch (error) {
    console.error('Ошибка обработки файла:', error.message);
    status = 'error';
    extractedText = '';
  }

  const fileUrl = `/uploads/${file.filename}`;

  const documentRecord = await prisma.document.create({
    data: {
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      extension,
      size: file.size,
      filePath: file.path,
      fileUrl,
      extractedText,
      status
    }
  });

  return documentRecord;
}

async function getDocumentById(documentId) {
  return prisma.document.findUnique({
    where: { id: documentId }
  });
}

async function getAllDocuments() {
  return prisma.document.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

module.exports = {
  processUploadedFile,
  getDocumentById,
  getAllDocuments
};