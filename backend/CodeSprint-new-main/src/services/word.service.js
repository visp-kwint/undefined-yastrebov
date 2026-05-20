// backend/CodeSprint-new-main/src/services/word.service.js
const mammoth = require('mammoth');

/**
 * Преобразует HTML, который вернул mammoth, в структурированный текст
 * с маркерами таблиц: |TABLE_START|, |ROW|, |CELL|, |TABLE_END|.
 */
function htmlToStructuredText(html) {
  if (!html) return '';

  let text = html;

  // Таблицы
  text = text.replace(/<table[^>]*>/gi, '\n|TABLE_START|\n');
  text = text.replace(/<\/table>/gi, '\n|TABLE_END|\n');
  text = text.replace(/<tr[^>]*>/gi, '');
  text = text.replace(/<\/tr>/gi, '|ROW|\n');
  text = text.replace(/<t[hd][^>]*>/gi, '');
  text = text.replace(/<\/t[hd]>/gi, '|CELL|');

  // Параграфы / переносы
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Убираем остальные теги
  text = text.replace(/<[^>]+>/g, '');

  // HTML-сущности
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Нормализация пробелов с сохранением переносов
  text = text
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n');

  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Извлекает текст из DOCX-файла с сохранением структуры таблиц.
 * @param {string} filePath - путь к .docx файлу
 * @returns {Promise<string>}
 */
async function extractTextFromWord(filePath) {
  console.log('[word.service] Старт извлечения:', filePath);

  if (!filePath || !filePath.toLowerCase().endsWith('.docx')) {
    console.warn('[word.service] Файл не .docx, пропуск:', filePath);
    return '';
  }

  try {
    // Извлекаем как HTML — таблицы сохранят структуру
    const htmlResult = await mammoth.convertToHtml({ path: filePath });
    const structured = htmlToStructuredText(htmlResult.value);

    console.log(
      `[word.service] HTML извлечён, символов: ${(htmlResult.value || '').length}, ` +
      `структурированного текста: ${structured.length}`
    );

    if (structured && structured.length > 0) {
      return structured;
    }

    // Fallback — обычный текст
    const rawResult = await mammoth.extractRawText({ path: filePath });
    const raw = rawResult.value ? rawResult.value.trim() : '';
    console.log('[word.service] Fallback raw text, символов:', raw.length);
    return raw;
  } catch (err) {
    console.error('[word.service] Ошибка извлечения DOCX:', err.message);
    try {
      const rawResult = await mammoth.extractRawText({ path: filePath });
      return rawResult.value ? rawResult.value.trim() : '';
    } catch (e) {
      console.error('[word.service] Полный сбой извлечения:', e.message);
      return '';
    }
  }
}

module.exports = {
  extractTextFromWord,
  htmlToStructuredText
};