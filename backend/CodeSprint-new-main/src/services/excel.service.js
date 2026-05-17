const XLSX = require('xlsx');
const fs = require('fs');

async function extractTextFromExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    let result = '';

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      result += `=== Лист: ${sheetName} ===\n`;

      data.forEach((row) => {
        if (row && row.length > 0) {
          const rowText = row.map(cell => {
            if (cell === null || cell === undefined) return '';
            return String(cell).trim();
          }).filter(cell => cell !== '').join('\t');

          if (rowText) {
            result += rowText + '\n';
          }
        }
      });

      result += '\n';
    });

    return result.trim();
  } catch (error) {
    console.error('Excel parse error:', error.message);
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return '';
    }
  }
}

module.exports = {
  extractTextFromExcel
};