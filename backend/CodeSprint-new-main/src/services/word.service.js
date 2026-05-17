const mammoth = require('mammoth');
const AppError = require('../utils/AppError');

async function extractTextFromDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value ? result.value.trim() : '';
}

async function extractTextFromWord(filePath) {
  if (!filePath.toLowerCase().endsWith('.docx')) {
    throw new AppError('Поддерживается только формат DOCX', 400);
  }

  return extractTextFromDocx(filePath);
}

module.exports = {
  extractTextFromWord
};