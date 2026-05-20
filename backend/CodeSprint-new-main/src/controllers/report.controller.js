const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'docmind-secret-key-change-in-production';

const { extractStructured } = require('../services/ai-extractor.service');

function getUserIdFromReq(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  try {
    return jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET).userId;
  } catch { return null; }
}

// ========== Генерация диаграмм (canvas) ==========
const generatePieChart = (labels, data, title) => {
  const { createCanvas } = require('canvas');
  const canvas = createCanvas(600, 400);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, 600, 400);

  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, 300, 30);

  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#4ade80', '#60a5fa'];
  const total = data.reduce((a, b) => a + b, 0);
  if (total <= 0) return canvas.toBuffer('image/png');

  let currentAngle = -Math.PI / 2;
  const centerX = 200;
  const centerY = 220;
  const radius = 120;

  data.forEach((value, i) => {
    const sliceAngle = (value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.stroke();

    const midAngle = currentAngle + sliceAngle / 2;
    const labelX = centerX + Math.cos(midAngle) * (radius * 0.7);
    const labelY = centerY + Math.sin(midAngle) * (radius * 0.7);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round((value / total) * 100) + '%', labelX, labelY);

    currentAngle += sliceAngle;
  });

  ctx.textAlign = 'left';
  labels.forEach((label, i) => {
    const y = 120 + i * 25;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(400, y - 10, 15, 15);
    ctx.fillStyle = '#e0e0e0';
    ctx.font = '14px Arial';
    ctx.fillText(String(label).substring(0, 20) + ' (' + data[i].toLocaleString() + ')', 425, y);
  });

  return canvas.toBuffer('image/png');
};

const generateBarChart = (labels, data, title, yLabel) => {
  const { createCanvas } = require('canvas');
  const canvas = createCanvas(700, 400);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, 700, 400);

  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, 350, 30);

  const chartTop = 60;
  const chartBottom = 320;
  const chartLeft = 80;
  const chartRight = 650;
  const chartHeight = chartBottom - chartTop;
  const chartWidth = chartRight - chartLeft;

  const maxValue = Math.max(...data, 1) * 1.1;
  const barWidth = (chartWidth / data.length) * 0.7;
  const barSpacing = (chartWidth / data.length) * 0.3;

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(chartLeft, chartTop);
  ctx.lineTo(chartLeft, chartBottom);
  ctx.lineTo(chartRight, chartBottom);
  ctx.stroke();

  for (let i = 0; i <= 5; i++) {
    const y = chartBottom - (chartHeight / 5) * i;
    ctx.strokeStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();
    ctx.fillStyle = '#888';
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxValue / 5 * i).toLocaleString(), chartLeft - 10, y + 4);
  }

  const colors = ['#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF', '#4ade80', '#60a5fa', '#fbbf24'];
  data.forEach((value, i) => {
    const barHeight = (value / maxValue) * chartHeight;
    const x = chartLeft + i * (barWidth + barSpacing) + barSpacing / 2;
    const y = chartBottom - barHeight;

    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(value.toLocaleString(), x + barWidth / 2, y - 5);

    ctx.fillStyle = '#888';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(labels[i]).substring(0, 12), x + barWidth / 2, chartBottom + 15);
  });

  ctx.save();
  ctx.translate(20, 200);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#888';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  return canvas.toBuffer('image/png');
};

// ========== Парсер числа из строки ==========
function parseNum(s) {
  if (s === null || s === undefined) return NaN;
  let str = String(s).trim();

  // Пустые/нулевые маркеры
  if (str === '' || str === '—' || str === '-' || str === 'н/д') return NaN;

  // Отрицательные в скобках: (123) или (12 345)
  const isNegative = /^\(.+\)$/.test(str);
  if (isNegative) str = str.slice(1, -1);

  // Чистим всё кроме цифр, точки, запятой, минуса
  const cleaned = str
    .replace(/[^\d.,\-]/g, '')
    .replace(/,/g, '.');

  if (!cleaned) return NaN;

  const n = parseFloat(cleaned);
  if (isNaN(n)) return NaN;

  return isNegative ? -n : n;
}

// ========== Парсер DOCX-маркеров |TABLE_START|/|ROW|/|CELL| ==========
function parseDocxMarkers(text) {
  if (!text || !text.includes('|TABLE_START|')) return null;

  const tables = [];
  const tableBlocks = text.split('|TABLE_START|').slice(1);

  for (const block of tableBlocks) {
    const endIdx = block.indexOf('|TABLE_END|');
    if (endIdx === -1) continue;
    const tableContent = block.substring(0, endIdx);

    const rowStrings = tableContent.split('|ROW|').map(r => r.trim()).filter(r => r.length > 0);
    if (rowStrings.length < 2) continue;

    const rows = rowStrings.map(rs => {
      // ячейки заканчиваются |CELL|
      return rs.split('|CELL|').map(c => c.trim()).filter((c, i, arr) => i < arr.length - 1 || c.length > 0);
    }).filter(r => r.length > 0);

    if (rows.length < 2) continue;

    // Нормализация: приводим все строки к максимальной длине
    const maxCols = Math.max(...rows.map(r => r.length));
    const normalized = rows.map(r => {
      while (r.length < maxCols) r.push('');
      return r.slice(0, maxCols);
    });

    const headers = normalized[0].map(h => h.replace(/\s+/g, ' ').trim() || '—');
    const dataRows = normalized.slice(1).filter(r => r.some(c => c && c.length > 0));

    if (dataRows.length > 0) {
      tables.push({ headers, rows: dataRows });
    }
  }

  if (tables.length === 0) return null;

  // Берём самую большую таблицу (по количеству строк)
  tables.sort((a, b) => b.rows.length - a.rows.length);
  console.log(`[parseDocxMarkers] Найдено таблиц: ${tables.length}, выбрана с ${tables[0].rows.length} строками и ${tables[0].headers.length} колонками`);
  return tables[0];
}

// ========== Парсер OCR-текста (изображения, PDF без структуры) ==========
function parseOcrTable(text) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 3) return null;

  // Ключевые слова заголовков таблиц
  const HEADER_KEYWORDS = ['ФИО', 'Должность', 'Оклад', 'Начислено', 'НДФЛ',
                          'Удержано', 'Выплате', 'Сотрудник', 'Сумма', 'Дата',
                          'Показатель', 'Количество', 'Цена', 'Наименование'];

  // Ищем строку, в которой много ключевых слов — это заголовок таблицы
  let headerLineIdx = -1;
  let headerCells = [];

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i];
    const matchCount = HEADER_KEYWORDS.filter(kw => line.includes(kw)).length;
    if (matchCount >= 2) {
      headerLineIdx = i;
      // Разбиваем по 2+ пробелам / табам / |
      headerCells = line.split(/\s{2,}|\t|\|/).map(c => c.trim()).filter(c => c.length > 0);
      if (headerCells.length >= 3) break;
    }
  }

  if (headerLineIdx === -1 || headerCells.length < 3) {
    // Альтернатива: ищем "№" + рядом текст
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      if (/^№\s/.test(lines[i]) || lines[i].includes('№ ФИО') || lines[i].includes('№\tФИО')) {
        headerLineIdx = i;
        headerCells = lines[i].split(/\s{2,}|\t|\|/).map(c => c.trim()).filter(c => c.length > 0);
        if (headerCells.length >= 3) break;
      }
    }
  }

  if (headerLineIdx === -1 || headerCells.length < 3) return null;

  const colCount = headerCells.length;
  const dataRows = [];

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];

    // Стоп-слова
    if (/^(ПОДПИСИ|Расчёт составил|Проверил|Утверждаю|Итого|ИТОГО|Всего)/i.test(line)) break;
    if (/^_+$/.test(line)) continue;

    // Разбиваем строку
    let cells = line.split(/\s{2,}|\t|\|/).map(c => c.trim()).filter(c => c.length > 0);

    // Если ячеек слишком мало — пробуем разбить по одиночным пробелам с эвристикой
    if (cells.length < colCount && cells.length >= 2) {
      cells = splitOcrRow(line, colCount);
    }

    // Принимаем строку, если в ней хотя бы 60% ячеек от headerCells
    if (cells.length >= Math.floor(colCount * 0.6)) {
      // Дополняем пустыми
      while (cells.length < colCount) cells.push('');
      cells = cells.slice(0, colCount);

      // Проверка: строка должна содержать хотя бы одно число
      if (cells.some(c => !isNaN(parseNum(c)) && parseNum(c) > 0)) {
        dataRows.push(cells);
      }
    }
  }

  if (dataRows.length === 0) return null;

  console.log(`[parseOcrTable] Распознано: ${dataRows.length} строк × ${colCount} колонок`);
  return { headers: headerCells, rows: dataRows };
}

// Эвристическое разбиение OCR-строки на N колонок
function splitOcrRow(line, expectedCols) {
  // Извлекаем числа (с пробелами как разделителями тысяч) и текстовые блоки
  const tokens = [];
  const regex = /([А-ЯA-Z][а-яa-zА-ЯA-Z.\-]+(?:\s+[А-ЯA-Z]\.?[А-ЯA-Z]?\.?)?(?:\s+[А-ЯA-Z][а-яa-zА-ЯA-Z]+)*|\d{1,3}(?:[\s\u00A0]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?(?:\/\d+)?|\d+\/\d+)/g;
  let m;
  while ((m = regex.exec(line)) !== null) {
    tokens.push(m[1].trim());
  }
  return tokens;
}

// ========== Главный парсер ==========
async function parseDocumentData(doc) {
  const text = doc.extractedText || '';

  // Ищем оригинальный файл для Vision
  let filePath = null;
  const uploadsDir = path.join(__dirname, '../data/uploads');

  // У вас в логе видно имя типа bee47094-9a54-49be-a79e-c86a5a6cff16.docx
  // Это поле обычно зовётся storedName / fileName / filePath в БД
  const candidates = [
    doc.filePath,
    doc.storedName && path.join(uploadsDir, doc.storedName),
    doc.fileName && path.join(uploadsDir, doc.fileName),
    doc.path,
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) { filePath = c; break; }
  }

  if (!filePath) {
    // Последний шанс — поискать по id в uploads
    try {
      const files = fs.readdirSync(uploadsDir);
      const found = files.find(f => f.startsWith(doc.id) || (doc.storedName && f === doc.storedName));
      if (found) filePath = path.join(uploadsDir, found);
    } catch {}
  }

  console.log(`[parseDocumentData] filePath: ${filePath || 'НЕ НАЙДЕН'}`);

  // === AI ===
  try {
    const aiResult = await extractStructured(doc, filePath);
    if (aiResult && aiResult.headers?.length > 0 && aiResult.rows?.length > 0) {
      console.log(`[parseDocumentData] AI: ${aiResult.rows.length} строк × ${aiResult.headers.length} колонок`);
      return {
        headers: aiResult.headers,
        rows: aiResult.rows,
        empty: false,
        aiMeta: {
          title: aiResult.title,
          description: aiResult.description,
          summary: aiResult.summary,
          chartSuggestion: aiResult.chartSuggestion
        }
      };
    }
  } catch (e) {
    console.error('[parseDocumentData] AI ошибка:', e.message);
  }

  // === Fallback на старые парсеры ===
  if (!text.trim()) return makeEmptyFallback(doc, text);

  const docxResult = parseDocxMarkers(text);
  if (docxResult?.rows.length > 0) return { headers: docxResult.headers, rows: docxResult.rows, empty: false };

  const verticalResult = parseVerticalTable(text);
  if (verticalResult?.rows.length > 0) return { headers: verticalResult.headers, rows: verticalResult.rows, empty: false };

  const horizontalResult = parseHorizontalTable(text);
  if (horizontalResult?.rows.length > 0) return { headers: horizontalResult.headers, rows: horizontalResult.rows, empty: false };

  const ocrResult = parseOcrTable(text);
  if (ocrResult?.rows.length > 0) return { headers: ocrResult.headers, rows: ocrResult.rows, empty: false };

  return makeEmptyFallback(doc, text);
}

function makeEmptyFallback(doc, text) {
  return {
    headers: ['Параметр', 'Значение'],
    rows: [
      ['Документ', doc.originalName || 'Без названия'],
      ['Размер', (doc.size / 1024).toFixed(1) + ' KB'],
      ['Тип', doc.mimeType || 'неизвестно'],
      ['Извлечено символов', String(text.length)],
      ['Примечание', 'Структурированные таблицы в документе не обнаружены']
    ],
    empty: true
  };
}

// Парсинг вертикальной таблицы (DOCX raw: ячейки разделены \n\n)
function parseVerticalTable(text) {
  const cells = text.split(/\n\s*\n/).map(c => c.trim()).filter(c => c.length > 0);
  if (cells.length < 6) return null;

  let startIdx = cells.findIndex(c => c === '№' || /^№$/.test(c));
  if (startIdx === -1) {
    startIdx = cells.findIndex(c => /^(ФИО|Сотрудник|Наименование|Показатель)$/i.test(c));
    if (startIdx === -1) return null;
  }

  let headers = [];
  let dataStartIdx = startIdx;

  for (let i = startIdx; i < Math.min(startIdx + 15, cells.length); i++) {
    const cell = cells[i];
    if (headers.length >= 2 && /^\d{1,3}$/.test(cell)) {
      dataStartIdx = i;
      break;
    }
    headers.push(cell);
  }

  if (headers.length < 2) return null;
  const colCount = headers.length;

  const rows = [];
  for (let i = dataStartIdx; i + colCount - 1 < cells.length; i += colCount) {
    const row = cells.slice(i, i + colCount);
    const firstCell = row[0];
    const isValidRow = /^\d{1,4}$/.test(firstCell) ||
                      (row.length === colCount && !row.some(c => c.length > 200));

    if (!isValidRow) break;
    if (row.some(c => /^(ПОДПИСИ|Расчёт составил|Проверил|Утверждаю|Итого)$/i.test(c))) break;
    rows.push(row);
  }

  if (rows.length === 0) return null;
  return { headers, rows };
}

// Парсинг горизонтальной таблицы
function parseHorizontalTable(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rows = [];
  let headers = [];
  let foundHeader = false;

  for (const line of lines) {
    if (/(ПОДПИСИ|Расчёт составил|Проверил|Утверждаю|____)/i.test(line)) continue;

    const cells = line.split(/\s{2,}|\t|;/).map(c => c.trim()).filter(c => c);

    if (cells.length >= 3 && cells.length <= 12) {
      if (!foundHeader) {
        headers = cells;
        foundHeader = true;
      } else {
        if (cells.length === headers.length) {
          rows.push(cells);
        }
      }
    }
  }

  if (rows.length === 0 || headers.length === 0) return null;
  return { headers, rows };
}

// ========== Основной контроллер ==========
const generateReport = async (req, res) => {
  try {
    const { documentId, type = 'all' } = req.body;

    if (!documentId) {
      return res.status(400).json({ success: false, message: 'Не передан ID документа' });
    }

    console.log('Ищем документ с ID:', documentId);

    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Требуется авторизация' });
    }

    const doc = await prisma.document.findFirst({
      where: { id: documentId, userId }
    });

    console.log('Найден документ:', doc ? doc.originalName : 'не найден');

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Документ не найден или нет доступа' });
    }

    const data = await parseDocumentData(doc);

    const reportFiles = [];
    let reportText = `Отчёт сгенерирован на основе документа: ${doc.originalName || 'Неизвестный документ'}`;

    if (data.aiMeta) {
      if (data.aiMeta.title) {
        reportText += `\n\n📄 ${data.aiMeta.title}`;
      }
      if (data.aiMeta.description) {
        reportText += `\n${data.aiMeta.description}`;
      }
      if (data.aiMeta.summary?.keyMetrics?.length) {
        reportText += '\n\n📊 Ключевые показатели:';
        for (const m of data.aiMeta.summary.keyMetrics) {
          reportText += `\n  • ${m.label}: ${m.value}`;
        }
      }
    }

    if (data.empty) {
      reportText += '\n\n⚠️ Структурированные таблицы не обнаружены.';
    } else {
      reportText += `\n\n✅ Распознано: ${data.rows.length} строк × ${data.headers.length} колонок.`;
    }

    const reportsDir = path.join(__dirname, '../../public/reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

        // ===== Умный выбор колонок для диаграмм =====
    const findColIdx = (keywords) => {
      for (const kw of keywords) {
        const idx = data.headers.findIndex(h => h && h.toLowerCase().includes(kw.toLowerCase()));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    // 🔥 Доверяем подсказке от AI, если она есть и валидна
    let valueColIdx = -1;
    let labelColIdx = -1;

    if (data.aiMeta?.chartSuggestion) {
      const sug = data.aiMeta.chartSuggestion;
      if (typeof sug.valueColumn === 'number' &&
          sug.valueColumn >= 0 &&
          sug.valueColumn < data.headers.length) {
        valueColIdx = sug.valueColumn;
      }
      if (typeof sug.labelColumn === 'number' &&
          sug.labelColumn >= 0 &&
          sug.labelColumn < data.headers.length) {
        labelColIdx = sug.labelColumn;
      }
      console.log(`[generateReport] AI подсказала: label=${labelColIdx}, value=${valueColIdx}`);
    }

    // Колонки-исключения (нельзя использовать как valueColumn)
    const isCodeColumn = (header) => {
      if (!header) return false;
      const h = header.toLowerCase();
      return h === 'код' || h === '№' || h === 'номер' || h === 'дата' ||
             h.includes('код стр') || h.startsWith('№ ');
    };

    // Если AI не подсказала или подсказала плохо — ищем сами
    if (labelColIdx === -1) {
      labelColIdx = findColIdx([
        'ФИО', 'Сотрудник', 'Наименование показателя',
        'Наименование', 'Показатель', 'Статья'
      ]);
      if (labelColIdx === -1) labelColIdx = 0;
    }

    if (valueColIdx === -1 || isCodeColumn(data.headers[valueColIdx])) {
      // Для финансовых отчётов: ищем самый свежий год
      valueColIdx = findColIdx(['2024', '2023', '2022', 'текущий', 'отчётн']);

      // Иначе — стандартные суммы
      if (valueColIdx === -1) {
        valueColIdx = findColIdx([
          'К выплате', 'Сумма', 'Итого', 'Начислено',
          'Стоимость', 'Цена'
        ]);
      }

      // Последний шанс — последняя колонка, если она не код
      if (valueColIdx === -1) {
        for (let i = data.headers.length - 1; i >= 0; i--) {
          if (!isCodeColumn(data.headers[i]) && i !== labelColIdx) {
            valueColIdx = i;
            break;
          }
        }
      }
    }

    // Защита: если valueCol всё ещё указывает на код — берём следующую
    while (valueColIdx >= 0 && isCodeColumn(data.headers[valueColIdx])) {
      valueColIdx++;
      if (valueColIdx >= data.headers.length) { valueColIdx = -1; break; }
    }

    console.log(`[generateReport] Итог: label="${data.headers[labelColIdx]}" (${labelColIdx}), value="${data.headers[valueColIdx]}" (${valueColIdx})`);

    const nameIdx = labelColIdx;
    const accruedIdx = valueColIdx;
    let netIdx = valueColIdx; // для финотчётов используем тот же столбец

    const names = data.rows.map((r, i) => {
      if (nameIdx >= 0 && r[nameIdx]) return String(r[nameIdx]).substring(0, 20);
      return r[0] || `Строка ${i + 1}`;
    });

    const accruedValues = data.rows.map(r => {
      if (accruedIdx >= 0) return parseNum(r[accruedIdx]) || 0;
      // Если колонка "начислено" не найдена — берём первое число в строке
      for (const cell of r) {
        const n = parseNum(cell);
        if (!isNaN(n) && n > 0) return n;
      }
      return 0;
    });

    const netValues = data.rows.map(r => {
      const v = parseNum(r[netIdx]);
      return isNaN(v) ? 0 : v;
    });

    // ========== PDF отчёт ==========
    if (type === 'all' || type === 'pdf') {
      try {
        const PDFDocument = require('pdfkit');
        const pdfFilename = `report-${doc.id}-${Date.now()}.pdf`;
        const pdfPath = path.join(reportsDir, pdfFilename);

        const pdfDoc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
        const pdfStream = fs.createWriteStream(pdfPath);
        pdfDoc.pipe(pdfStream);

        // Шрифт с поддержкой кириллицы
        const fontPath = path.join(__dirname, '../../public/fonts/DejaVuSans.ttf');
        const fontBoldPath = path.join(__dirname, '../../public/fonts/DejaVuSans-Bold.ttf');
        let fontRegular = 'Helvetica';
        let fontBold = 'Helvetica-Bold';

        if (fs.existsSync(fontPath)) {
          pdfDoc.registerFont('DejaVu', fontPath);
          fontRegular = 'DejaVu';
        }
        if (fs.existsSync(fontBoldPath)) {
          pdfDoc.registerFont('DejaVu-Bold', fontBoldPath);
          fontBold = 'DejaVu-Bold';
        }

        // Заголовок
        pdfDoc.font(fontBold).fontSize(20).fillColor('#1a1a1a')
              .text('Аналитический отчёт', { align: 'center' });
        pdfDoc.moveDown(0.3);
        pdfDoc.font(fontRegular).fontSize(11).fillColor('#555')
              .text(`Документ: ${doc.originalName || 'без названия'}`, { align: 'center' });
        pdfDoc.text(`Дата формирования: ${new Date().toLocaleString('ru-RU')}`, { align: 'center' });
        pdfDoc.moveDown(1);

        // Сводная информация
        pdfDoc.font(fontBold).fontSize(13).fillColor('#1a1a1a').text('Сводная информация');
        pdfDoc.moveDown(0.3);
        pdfDoc.font(fontRegular).fontSize(10).fillColor('#333');

        if (data.empty) {
          pdfDoc.text('⚠ Структурированные таблицы в документе не обнаружены.');
          pdfDoc.text(`Размер файла: ${(doc.size / 1024).toFixed(1)} KB`);
          pdfDoc.text(`Тип: ${doc.mimeType || 'неизвестно'}`);
        } else {
          const totalAccrued = accruedValues.reduce((a, b) => a + b, 0);
          const totalNet = netValues.reduce((a, b) => a + b, 0);
          pdfDoc.text(`Всего записей: ${data.rows.length}`);
          pdfDoc.text(`Колонок в таблице: ${data.headers.length}`);
          if (totalAccrued > 0) pdfDoc.text(`Сумма по основной колонке: ${totalAccrued.toLocaleString('ru-RU')}`);
          if (totalNet > 0 && totalNet !== totalAccrued)
            pdfDoc.text(`Сумма по итоговой колонке: ${totalNet.toLocaleString('ru-RU')}`);
        }
        pdfDoc.moveDown(1);

        // Таблица
        pdfDoc.font(fontBold).fontSize(13).fillColor('#1a1a1a').text('Данные документа');
        pdfDoc.moveDown(0.5);

        const tableTop = pdfDoc.y;
        const pageWidth = pdfDoc.page.width - 80;
        const colCount = data.headers.length;
        const colWidth = pageWidth / colCount;
        const rowHeight = 22;
        let currentY = tableTop;

        // Заголовок таблицы
        pdfDoc.rect(40, currentY, pageWidth, rowHeight).fill('#2c3e50');
        pdfDoc.font(fontBold).fontSize(9).fillColor('#ffffff');
        data.headers.forEach((header, i) => {
          pdfDoc.text(String(header).substring(0, 25), 42 + i * colWidth, currentY + 7, {
            width: colWidth - 4, align: 'center', lineBreak: false
          });
        });
        currentY += rowHeight;

        // Строки
        pdfDoc.font(fontRegular).fontSize(8).fillColor('#1a1a1a');
        data.rows.forEach((row, rowIdx) => {
          // Перенос на новую страницу
          if (currentY + rowHeight > pdfDoc.page.height - 50) {
            pdfDoc.addPage();
            currentY = 40;
            pdfDoc.rect(40, currentY, pageWidth, rowHeight).fill('#2c3e50');
            pdfDoc.font(fontBold).fontSize(9).fillColor('#ffffff');
            data.headers.forEach((header, i) => {
              pdfDoc.text(String(header).substring(0, 25), 42 + i * colWidth, currentY + 7, {
                width: colWidth - 4, align: 'center', lineBreak: false
              });
            });
            currentY += rowHeight;
            pdfDoc.font(fontRegular).fontSize(8).fillColor('#1a1a1a');
          }

          // Зебра
          if (rowIdx % 2 === 0) {
            pdfDoc.rect(40, currentY, pageWidth, rowHeight).fill('#f5f5f5');
          }
          pdfDoc.fillColor('#1a1a1a');

          for (let i = 0; i < colCount; i++) {
            const cellValue = row[i] !== undefined && row[i] !== null ? String(row[i]) : '';
            pdfDoc.text(cellValue.substring(0, 30), 42 + i * colWidth, currentY + 7, {
              width: colWidth - 4, align: 'center', lineBreak: false
            });
          }
          currentY += rowHeight;
        });

        // Диаграммы
        if (!data.empty && accruedValues.some(v => v > 0)) {
          pdfDoc.addPage();
          pdfDoc.font(fontBold).fontSize(14).fillColor('#1a1a1a')
                .text('Визуализация данных', { align: 'center' });
          pdfDoc.moveDown(1);

          try {
            const top10Idx = accruedValues
              .map((v, i) => ({ v, i }))
              .sort((a, b) => b.v - a.v)
              .slice(0, 10);
            const topNames = top10Idx.map(o => names[o.i]);
            const topValues = top10Idx.map(o => o.v);

            const barBuf = generateBarChart(topNames, topValues, 'Топ-10 значений', 'Сумма');
            pdfDoc.image(barBuf, 60, pdfDoc.y, { width: 700 });
            pdfDoc.moveDown(20);

            const pieBuf = generatePieChart(topNames.slice(0, 6), topValues.slice(0, 6), 'Распределение (топ-6)');
            pdfDoc.image(pieBuf, 100, pdfDoc.y, { width: 600 });
          } catch (chartErr) {
            console.error('Ошибка генерации диаграмм:', chartErr.message);
            pdfDoc.font(fontRegular).fontSize(10).fillColor('#888')
                  .text('Диаграммы не удалось построить: ' + chartErr.message);
          }
        }

        pdfDoc.end();
        await new Promise((resolve, reject) => {
          pdfStream.on('finish', resolve);
          pdfStream.on('error', reject);
        });

        reportFiles.push({
          name: 'Отчёт PDF',
          url: `/reports/${pdfFilename}`,
          type: 'pdf'
        });
      } catch (pdfErr) {
        console.error('Ошибка генерации PDF:', pdfErr);
      }
    }

    // ========== Excel отчёт ==========
    if (type === 'all' || type === 'excel') {
      try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'DocMind';
        workbook.created = new Date();

        // === Лист 1: Сводка ===
        const summarySheet = workbook.addWorksheet('Сводка');
        summarySheet.columns = [
          { header: 'Параметр', key: 'param', width: 35 },
          { header: 'Значение', key: 'value', width: 45 }
        ];
        summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getRow(1).fill = {
          type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' }
        };

        const totalAccrued = accruedValues.reduce((a, b) => a + b, 0);
        const totalNet = netValues.reduce((a, b) => a + b, 0);

        summarySheet.addRow({ param: 'Документ', value: doc.originalName || '—' });
        summarySheet.addRow({ param: 'Дата формирования', value: new Date().toLocaleString('ru-RU') });
        summarySheet.addRow({ param: 'Размер файла', value: (doc.size / 1024).toFixed(1) + ' KB' });
        summarySheet.addRow({ param: 'Тип файла', value: doc.mimeType || '—' });
        summarySheet.addRow({ param: 'Извлечено символов', value: (doc.extractedText || '').length });

        if (!data.empty) {
          summarySheet.addRow({ param: 'Строк в таблице', value: data.rows.length });
          summarySheet.addRow({ param: 'Колонок в таблице', value: data.headers.length });
          if (totalAccrued > 0) summarySheet.addRow({ param: 'Сумма (основная колонка)', value: totalAccrued });
          if (totalNet > 0 && totalNet !== totalAccrued)
            summarySheet.addRow({ param: 'Сумма (итоговая колонка)', value: totalNet });
        } else {
          summarySheet.addRow({ param: 'Примечание', value: 'Структурированные таблицы не обнаружены' });
        }

        // === Лист 2: Данные ===
        const dataSheet = workbook.addWorksheet('Данные');
        dataSheet.columns = data.headers.map((h, i) => ({
          header: h || `Колонка ${i + 1}`,
          key: `col_${i}`,
          width: Math.max(15, Math.min(40, String(h || '').length + 5))
        }));

        const headerRow = dataSheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
          type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' }
        };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

        data.rows.forEach((row, rowIdx) => {
          const rowObj = {};
          data.headers.forEach((_, i) => {
            const v = row[i];
            const num = parseNum(v);
            rowObj[`col_${i}`] = (!isNaN(num) && String(v).match(/^[\d\s.,\-]+$/)) ? num : (v || '');
          });
          const r = dataSheet.addRow(rowObj);
          if (rowIdx % 2 === 0) {
            r.eachCell(cell => {
              cell.fill = {
                type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' }
              };
            });
          }
        });

        // Границы для всех ячеек
        dataSheet.eachRow((row) => {
          row.eachCell(cell => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
              left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
              bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
              right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
            };
          });
        });

        // === Лист 3: Аналитика (если есть числовые данные) ===
        if (!data.empty && accruedValues.some(v => v > 0)) {
          const analyticsSheet = workbook.addWorksheet('Аналитика');
          analyticsSheet.columns = [
            { header: 'Наименование', key: 'name', width: 35 },
            { header: 'Значение', key: 'value', width: 20 },
            { header: 'Доля, %', key: 'share', width: 15 }
          ];

          const analHeader = analyticsSheet.getRow(1);
          analHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          analHeader.fill = {
            type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' }
          };

          const sorted = names.map((n, i) => ({ name: n, value: accruedValues[i] }))
            .filter(o => o.value > 0)
            .sort((a, b) => b.value - a.value);

          const total = sorted.reduce((a, b) => a + b.value, 0);
          sorted.forEach(item => {
            analyticsSheet.addRow({
              name: item.name,
              value: item.value,
              share: total > 0 ? +((item.value / total) * 100).toFixed(2) : 0
            });
          });

          analyticsSheet.addRow({ name: 'ИТОГО', value: total, share: 100 });
          const lastRow = analyticsSheet.lastRow;
          lastRow.font = { bold: true };
          lastRow.fill = {
            type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' }
          };
        }

        const xlsxFilename = `report-${doc.id}-${Date.now()}.xlsx`;
        const xlsxPath = path.join(reportsDir, xlsxFilename);
        await workbook.xlsx.writeFile(xlsxPath);

        reportFiles.push({
          name: 'Отчёт Excel',
          url: `/reports/${xlsxFilename}`,
          type: 'excel'
        });
      } catch (xlsxErr) {
        console.error('Ошибка генерации Excel:', xlsxErr);
      }
    }

    // ========== СБОРКА ОТВЕТА ДЛЯ ФРОНТА ==========

    // Таблицы для рендера в чате
    const tables = [];

    if (!data.empty) {
      // Главная таблица — данные из документа
      tables.push({
        title: data.aiMeta?.title || 'Данные документа',
        headers: data.headers,
        rows: data.rows
      });

      // Сводная таблица с ключевыми метриками от AI
      if (data.aiMeta?.summary?.keyMetrics?.length) {
        tables.push({
          title: 'Ключевые показатели',
          headers: ['Показатель', 'Значение'],
          rows: data.aiMeta.summary.keyMetrics.map(m => [m.label, String(m.value)])
        });
      }

      // Итоги по числовым колонкам
      const totalAccrued = accruedValues.reduce((a, b) => a + b, 0);
      const totalNet = netValues.reduce((a, b) => a + b, 0);
      if (totalAccrued > 0 || totalNet > 0) {
        const totalsRows = [];
        if (totalAccrued > 0) {
          totalsRows.push(['Сумма (основная колонка)', totalAccrued.toLocaleString('ru-RU')]);
        }
        if (totalNet > 0 && totalNet !== totalAccrued) {
          totalsRows.push(['Сумма (итоговая колонка)', totalNet.toLocaleString('ru-RU')]);
        }
        totalsRows.push(['Всего строк', String(data.rows.length)]);
        if (totalsRows.length > 0) {
          tables.push({
            title: 'Итоги',
            headers: ['Метрика', 'Значение'],
            rows: totalsRows
          });
        }
      }
    } else {
      // Если структура не извлечена — показываем мета-инфу
      tables.push({
        title: 'Информация о документе',
        headers: data.headers,
        rows: data.rows
      });
    }

    // Диаграммы для inline-отображения (генерируем base64 PNG)
    const images = [];
    if (!data.empty && accruedValues.some(v => v > 0)) {
      try {
        const top10 = accruedValues
          .map((v, i) => ({ v, name: names[i] }))
          .sort((a, b) => b.v - a.v)
          .slice(0, 10);

        const topNames = top10.map(o => o.name);
        const topValues = top10.map(o => o.v);

        // Бар-чарт
        const barBuf = generateBarChart(topNames, topValues, 'Топ-10 значений', 'Сумма');
        images.push({
          name: 'Топ значений (столбчатая)',
          dataUrl: 'data:image/png;base64,' + barBuf.toString('base64')
        });

        // Круговая
        const pieBuf = generatePieChart(
          topNames.slice(0, 6),
          topValues.slice(0, 6),
          'Распределение (топ-6)'
        );
        images.push({
          name: 'Распределение (круговая)',
          dataUrl: 'data:image/png;base64,' + pieBuf.toString('base64')
        });
      } catch (chartErr) {
        console.error('[generateReport] Ошибка диаграмм для inline:', chartErr.message);
      }
    }

    // Прикреплённые файлы (PDF, Excel)
    const attachments = reportFiles.map(f => ({
      name: f.name,
      url: f.url,
      type: f.type
    }));

    return res.json({
      success: true,
      // Старый формат (на случай если где-то ещё используется)
      message: reportText,
      reportFiles,
      // 🔥 НОВЫЙ формат для renderReport на фронте
      data: {
        text: reportText,
        tables,
        images,
        attachments,
        // мета-информация
        headers: data.headers,
        rowsCount: data.rows.length,
        empty: data.empty
      }
    });

  } catch (err) {
    console.error('Ошибка generateReport:', err);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при генерации отчёта: ' + err.message
    });
  }
};

// ========== Генерация отчёта по НЕСКОЛЬКИМ документам как ОДНОМУ ==========
const generateReportMulti = async (req, res) => {
  try {
    const { documentIds, type = 'all' } = req.body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Не переданы ID документов' });
    }

    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Требуется авторизация' });
    }

    const docs = await prisma.document.findMany({
      where: { id: { in: documentIds }, userId }
    });

    if (docs.length === 0) {
      return res.status(404).json({ success: false, message: 'Документы не найдены' });
    }

    console.log(`[generateReportMulti] Объединяю ${docs.length} документов в один контекст`);

    // === Объединяем тексты всех документов в один ===
    let combinedText = '';
    const fileNames = [];
    const uploadsDir = path.join(__dirname, '../data/uploads');

    for (const d of docs) {
      fileNames.push(d.originalName);
      let text = d.extractedText && d.extractedText.trim();

      // 🔥 Если текста нет — запускаем OCR/повторное извлечение
      if (!text || text.length < 5) {
        console.log(`[generateReportMulti] Текст пуст для "${d.originalName}", запускаю повторное извлечение...`);

        // Находим файл на диске
        let filePath = null;
        const candidates = [
          d.filePath,
          d.storedName && path.join(uploadsDir, d.storedName),
        ].filter(Boolean);

        for (const c of candidates) {
          if (fs.existsSync(c)) { filePath = c; break; }
        }

        if (!filePath) {
          try {
            const files = fs.readdirSync(uploadsDir);
            const found = files.find(f => f.startsWith(d.id) || (d.storedName && f === d.storedName));
            if (found) filePath = path.join(uploadsDir, found);
          } catch {}
        }

        if (filePath && fs.existsSync(filePath)) {
          try {
            const ext = path.extname(filePath).toLowerCase();
            if (/\.(jpe?g|png|webp|bmp|gif|tiff?)$/i.test(ext)) {
              const { recognizeImage } = require('../services/ocr.service');
              console.log(`[generateReportMulti] OCR файла: ${filePath}`);
              text = await recognizeImage(filePath);
              console.log(`[generateReportMulti] OCR извлёк ${(text || '').length} симв.`);

              // Сохраняем в БД, чтобы в следующий раз не повторять
              if (text && text.trim().length > 5) {
                try {
                  await prisma.document.update({
                    where: { id: d.id },
                    data: { extractedText: text, status: 'processed' }
                  });
                } catch (e) {
                  console.warn('[generateReportMulti] Не удалось сохранить OCR-текст:', e.message);
                }
              }
            }
          } catch (e) {
            console.error(`[generateReportMulti] Ошибка OCR для ${d.originalName}:`, e.message);
          }
        } else {
          console.warn(`[generateReportMulti] Файл не найден на диске для ${d.originalName}`);
        }
      }

      if (text && text.trim()) {
        combinedText += `\n\n=== Часть документа: ${d.originalName} ===\n${text}`;
      }
    }

    if (!combinedText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Не удалось извлечь текст ни из одного документа. Попробуйте загрузить более качественные изображения.'
      });
    }

    // Создаём виртуальный "объединённый" документ
    const virtualDoc = {
      id: docs.map(d => d.id).join('+'),
      originalName: docs.length === 1
        ? docs[0].originalName
        : `Объединённый документ (${docs.length} частей): ${fileNames.join(', ')}`,
      mimeType: docs[0].mimeType,
      size: docs.reduce((sum, d) => sum + (d.size || 0), 0),
      extractedText: combinedText,
      filePath: null,
      storedName: null
    };

    // === Парсим как единое целое ===
    const data = await parseDocumentData(virtualDoc);

    const reportFiles = [];
    let reportText = `Отчёт сгенерирован на основе ${docs.length} ${docs.length === 1 ? 'документа' : 'документов'}: ${fileNames.join(', ')}`;

    if (data.aiMeta) {
      if (data.aiMeta.title) reportText += `\n\n📄 ${data.aiMeta.title}`;
      if (data.aiMeta.description) reportText += `\n${data.aiMeta.description}`;
      if (data.aiMeta.summary?.keyMetrics?.length) {
        reportText += '\n\n📊 Ключевые показатели:';
        for (const m of data.aiMeta.summary.keyMetrics) {
          reportText += `\n  • ${m.label}: ${m.value}`;
        }
      }
    }

    if (data.empty) {
      reportText += '\n\n⚠️ Структурированные таблицы не обнаружены.';
    } else {
      reportText += `\n\n✅ Распознано: ${data.rows.length} строк × ${data.headers.length} колонок.`;
    }

    const reportsDir = path.join(__dirname, '../../public/reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    // === Логика выбора колонок (та же, что и в generateReport) ===
    const findColIdx = (keywords) => {
      for (const kw of keywords) {
        const idx = data.headers.findIndex(h => h && h.toLowerCase().includes(kw.toLowerCase()));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    let valueColIdx = -1;
    let labelColIdx = -1;

    if (data.aiMeta?.chartSuggestion) {
      const sug = data.aiMeta.chartSuggestion;
      if (typeof sug.valueColumn === 'number' && sug.valueColumn >= 0 && sug.valueColumn < data.headers.length) {
        valueColIdx = sug.valueColumn;
      }
      if (typeof sug.labelColumn === 'number' && sug.labelColumn >= 0 && sug.labelColumn < data.headers.length) {
        labelColIdx = sug.labelColumn;
      }
    }

    const isCodeColumn = (header) => {
      if (!header) return false;
      const h = header.toLowerCase();
      return h === 'код' || h === 'no' || h === 'номер' || h === 'дата' ||
             h.includes('код стр') || h.startsWith('no ');
    };

    if (labelColIdx === -1) {
      labelColIdx = findColIdx(['ФИО', 'Сотрудник', 'Наименование показателя', 'Наименование', 'Показатель', 'Статья']);
      if (labelColIdx === -1) labelColIdx = 0;
    }

    if (valueColIdx === -1 || isCodeColumn(data.headers[valueColIdx])) {
      valueColIdx = findColIdx(['2024', '2023', '2022', 'текущий', 'отчётн']);
      if (valueColIdx === -1) {
        valueColIdx = findColIdx(['К выплате', 'Сумма', 'Итого', 'Начислено', 'Стоимость', 'Цена']);
      }
      if (valueColIdx === -1) {
        for (let i = data.headers.length - 1; i >= 0; i--) {
          if (!isCodeColumn(data.headers[i]) && i !== labelColIdx) { valueColIdx = i; break; }
        }
      }
    }

    while (valueColIdx >= 0 && isCodeColumn(data.headers[valueColIdx])) {
      valueColIdx++;
      if (valueColIdx >= data.headers.length) { valueColIdx = -1; break; }
    }

    console.log(`[generateReportMulti] Колонки: label="${data.headers[labelColIdx]}" (${labelColIdx}), value="${data.headers[valueColIdx]}" (${valueColIdx})`);

    const nameIdx = labelColIdx;
    const accruedIdx = valueColIdx;

    const names = data.rows.map((r, i) => {
      if (nameIdx >= 0 && r[nameIdx]) return String(r[nameIdx]).substring(0, 30);
      return r[0] || `Строка ${i + 1}`;
    });

    const accruedValues = data.rows.map(r => {
      if (accruedIdx >= 0) return parseNum(r[accruedIdx]) || 0;
      for (const cell of r) {
        const n = parseNum(cell);
        if (!isNaN(n) && n > 0) return n;
      }
      return 0;
    });

    // === Сборка таблиц для фронта ===
    const tables = [];

    if (!data.empty) {
      tables.push({
        title: data.aiMeta?.title || 'Объединённые данные',
        headers: data.headers,
        rows: data.rows
      });

      if (data.aiMeta?.summary?.keyMetrics?.length) {
        tables.push({
          title: 'Ключевые показатели',
          headers: ['Показатель', 'Значение'],
          rows: data.aiMeta.summary.keyMetrics.map(m => [m.label, String(m.value)])
        });
      }

      const totalAccrued = accruedValues.reduce((a, b) => a + b, 0);
      if (totalAccrued > 0) {
        tables.push({
          title: 'Итоги',
          headers: ['Метрика', 'Значение'],
          rows: [
            ['Сумма по основной колонке', totalAccrued.toLocaleString('ru-RU')],
            ['Всего строк', String(data.rows.length)],
            ['Объединено документов', String(docs.length)]
          ]
        });
      }
    } else {
      tables.push({
        title: 'Информация о документах',
        headers: ['Параметр', 'Значение'],
        rows: [
          ['Объединено документов', String(docs.length)],
          ['Имена файлов', fileNames.join(', ')],
          ['Общий размер', `${(virtualDoc.size / 1024).toFixed(1)} KB`],
          ['Извлечено символов', String(combinedText.length)]
        ]
      });
    }

    // === Диаграммы ===
    const images = [];
    if (!data.empty && accruedValues.some(v => v > 0)) {
      try {
        const top10 = accruedValues
          .map((v, i) => ({ v, name: names[i] }))
          .sort((a, b) => b.v - a.v)
          .slice(0, 10);

        const topNames = top10.map(o => o.name);
        const topValues = top10.map(o => o.v);

        const barBuf = generateBarChart(topNames, topValues, 'Топ-10 значений', 'Сумма');
        images.push({
          name: 'Топ значений (столбчатая)',
          dataUrl: 'data:image/png;base64,' + barBuf.toString('base64')
        });

        const pieBuf = generatePieChart(
          topNames.slice(0, 6),
          topValues.slice(0, 6),
          'Распределение (топ-6)'
        );
        images.push({
          name: 'Распределение (круговая)',
          dataUrl: 'data:image/png;base64,' + pieBuf.toString('base64')
        });
      } catch (chartErr) {
        console.error('[generateReportMulti] Ошибка диаграмм:', chartErr.message);
      }
    }

    // === Excel ===
    if (type === 'all' || type === 'excel') {
      try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'DocMind';
        workbook.created = new Date();

        const summarySheet = workbook.addWorksheet('Сводка');
        summarySheet.columns = [
          { header: 'Параметр', key: 'param', width: 35 },
          { header: 'Значение', key: 'value', width: 45 }
        ];
        summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };

        summarySheet.addRow({ param: 'Тип отчёта', value: 'Объединённый' });
        summarySheet.addRow({ param: 'Документов объединено', value: docs.length });
        summarySheet.addRow({ param: 'Имена файлов', value: fileNames.join(', ') });
        summarySheet.addRow({ param: 'Дата формирования', value: new Date().toLocaleString('ru-RU') });
        summarySheet.addRow({ param: 'Общий размер', value: (virtualDoc.size / 1024).toFixed(1) + ' KB' });

        if (!data.empty) {
          summarySheet.addRow({ param: 'Строк в таблице', value: data.rows.length });
          summarySheet.addRow({ param: 'Колонок', value: data.headers.length });
          const totalAccrued = accruedValues.reduce((a, b) => a + b, 0);
          if (totalAccrued > 0) summarySheet.addRow({ param: 'Сумма', value: totalAccrued });
        }

        const dataSheet = workbook.addWorksheet('Данные');
        dataSheet.columns = data.headers.map((h, i) => ({
          header: h || `Колонка ${i + 1}`,
          key: `col_${i}`,
          width: Math.max(15, Math.min(40, String(h || '').length + 5))
        }));
        const headerRow = dataSheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2c3e50' } };

        data.rows.forEach((row, rowIdx) => {
          const rowObj = {};
          data.headers.forEach((_, i) => {
            const v = row[i];
            const num = parseNum(v);
            rowObj[`col_${i}`] = (!isNaN(num) && String(v).match(/^[\d\s.,\-]+$/)) ? num : (v || '');
          });
          const r = dataSheet.addRow(rowObj);
          if (rowIdx % 2 === 0) {
            r.eachCell(cell => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
            });
          }
        });

        const xlsxFilename = `report-multi-${Date.now()}.xlsx`;
        const xlsxPath = path.join(reportsDir, xlsxFilename);
        await workbook.xlsx.writeFile(xlsxPath);

        reportFiles.push({
          name: 'Отчёт Excel (объединённый)',
          url: `/reports/${xlsxFilename}`,
          type: 'excel'
        });
      } catch (xlsxErr) {
        console.error('[generateReportMulti] Ошибка Excel:', xlsxErr);
      }
    }

    const attachments = reportFiles.map(f => ({ name: f.name, url: f.url, type: f.type }));

    return res.json({
      success: true,
      message: reportText,
      reportFiles,
      data: {
        text: reportText,
        tables,
        images,
        attachments,
        headers: data.headers,
        rowsCount: data.rows.length,
        empty: data.empty,
        mergedFrom: docs.length
      }
    });

  } catch (err) {
    console.error('[generateReportMulti] Ошибка:', err);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при генерации объединённого отчёта: ' + err.message
    });
  }
};

module.exports = { generateReport, generateReportMulti };