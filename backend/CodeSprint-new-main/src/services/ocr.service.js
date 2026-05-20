const Tesseract = require('tesseract.js');
const path = require('path');

/**
 * Распознаёт текст с изображения с сохранением структуры таблицы
 * @param {string} imagePath - путь к изображению
 * @returns {Promise<string>}
 */
async function recognizeImage(imagePath) {
    console.log(`[OCR] Распознавание: ${imagePath}`);

    const result = await Tesseract.recognize(imagePath, 'rus+eng', {
    logger: m => {
        if (m.status === 'recognizing text' && m.progress) {
        process.stdout.write(`\r[OCR] ${Math.round(m.progress * 100)}%`);
        }
    },
    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    preserve_interword_spaces: '1'
    });

    console.log('\n[OCR] Готово');

  // Группировка слов по строкам через координаты (для таблиц)
    const structuredText = buildStructuredText(result.data);

    return structuredText || result.data.text;
}

/**
 * Преобразует данные Tesseract в текст с табуляцией между столбцами
 */
function buildStructuredText(data) {
    if (!data || !data.lines || data.lines.length === 0) return '';

    const outputLines = [];

    for (const line of data.lines) {
    if (!line.words || line.words.length === 0) {
        outputLines.push(line.text.trim());
        continue;
    }

    // Сортируем слова по X
    const words = line.words
        .filter(w => w.text && w.text.trim().length > 0)
        .sort((a, b) => a.bbox.x0 - b.bbox.x0);

    if (words.length === 0) continue;

    // Среднее расстояние между словами — для определения "колоночных" пробелов
    let parts = [words[0].text];
    let prevRight = words[0].bbox.x1;
    const avgCharWidth = words[0].bbox.x1 - words[0].bbox.x0;

    for (let i = 1; i < words.length; i++) {
        const gap = words[i].bbox.x0 - prevRight;
        const charW = Math.max(avgCharWidth, (words[i].bbox.x1 - words[i].bbox.x0) / Math.max(1, words[i].text.length));

      // Большой промежуток → разделитель столбцов (4+ пробелов)
      if (gap > charW * 2.5) {
        parts.push('    ' + words[i].text);
        } else {
        parts.push(' ' + words[i].text);
        }
        prevRight = words[i].bbox.x1;
    }

    outputLines.push(parts.join('').replace(/^\s+/, ''));
    }

    return outputLines.join('\n');
}

module.exports = {
    recognizeImage,
    extractTextFromImage: recognizeImage
};