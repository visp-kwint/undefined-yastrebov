const fs = require('fs');

async function extractTextFromPdf(filePath) {
  try {
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text ? data.text.trim() : '';
  } catch (error) {
    console.error('pdf-parse error:', error.message);
    return '';
  }
}

module.exports = { extractTextFromPdf };