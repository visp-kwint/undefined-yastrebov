const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'docmind-secret-key-change-in-production';

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
    ctx.fillText(label + ' (' + data[i].toLocaleString() + ')', 425, y);
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

  const maxValue = Math.max(...data) * 1.1;
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
    ctx.fillText(labels[i], x + barWidth / 2, chartBottom + 15);
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

// ========== Парсинг документа ==========
function parseDocumentData(doc) {
  const text = doc.extractedText || '';
  if (!text.trim()) {
    return makeEmptyFallback(doc, text);
  }

  // Стратегия 1: вертикальная таблица DOCX (ячейки через \n\n)
  const verticalResult = parseVerticalTable(text);
  if (verticalResult && verticalResult.rows.length > 0) {
    console.log(`[parseDocumentData] Вертикальная таблица: ${verticalResult.rows.length} строк, ${verticalResult.headers.length} колонок`);
    return { headers: verticalResult.headers, rows: verticalResult.rows, empty: false };
  }

  // Стратегия 2: построчная таблица (разделители — 2+ пробела, табы, запятые)
  const horizontalResult = parseHorizontalTable(text);
  if (horizontalResult && horizontalResult.rows.length > 0) {
    console.log(`[parseDocumentData] Горизонтальная таблица: ${horizontalResult.rows.length} строк`);
    return { headers: horizontalResult.headers, rows: horizontalResult.rows, empty: false };
  }

  // Fallback: метаданные
  console.log('[parseDocumentData] Таблицы не распознаны, возвращаем метаданные');
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

// Парсинг вертикальной таблицы (DOCX: ячейки разделены \n\n)
function parseVerticalTable(text) {
  const cells = text.split(/\n\s*\n/).map(c => c.trim()).filter(c => c.length > 0);
  if (cells.length < 6) return null;

  // Ищем "№" — начало таблицы
  let startIdx = cells.findIndex(c => c === '№' || /^№$/.test(c));
  if (startIdx === -1) {
    // Пробуем найти по ключевым словам в первых ячейках
    startIdx = cells.findIndex(c => /^(ФИО|Сотрудник|Наименование|Показатель)$/i.test(c));
    if (startIdx === -1) return null;
  }

  // Определяем количество колонок: ищем подряд идущие "заголовочные" ячейки
  // (короткие, без пробелов в начале, до первой ячейки с числом-индексом строки)
  const standardKeywords = ['ФИО', 'Должность', 'Оклад', 'Начислено', 'НДФЛ', 'К выплате', 'Удержано',
                            'Сотрудник', 'Сумма', 'Дата', 'Количество', 'Цена', 'Итого', 'Отработано'];

  let headers = [];
  let dataStartIdx = startIdx;

  // Берём ячейки начиная со startIdx и идём пока не встретим "1" (первая строка данных)
  for (let i = startIdx; i < Math.min(startIdx + 15, cells.length); i++) {
    const cell = cells[i];
    // Если встретили чистое число 1-3 цифр после хотя бы одного заголовка — это начало данных
    if (headers.length >= 2 && /^\d{1,3}$/.test(cell)) {
      dataStartIdx = i;
      break;
    }
    headers.push(cell);
  }

  if (headers.length < 2) return null;

  const colCount = headers.length;

  // Собираем строки данных по colCount ячеек
  const rows = [];
  for (let i = dataStartIdx; i + colCount - 1 < cells.length; i += colCount) {
    const row = cells.slice(i, i + colCount);

    // Проверка: первая ячейка должна быть номером или коротким значением
    // и в строке должны быть какие-то осмысленные данные
    const firstCell = row[0];
    const isValidRow = /^\d{1,4}$/.test(firstCell) ||
                      (row.length === colCount && !row.some(c => c.length > 200));

    if (!isValidRow) break;

    // Стоп-слова: если встретили служебный текст
    if (row.some(c => /^(ПОДПИСИ|Расчёт составил|Проверил|Утверждаю|Итого)$/i.test(c))) {
      break;
    }

    rows.push(row);
  }

  if (rows.length === 0) return null;

  return { headers, rows };
}

// Парсинг горизонтальной таблицы (одна запись = одна строка с разделителями)
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
        // Первая длинная строка с 3+ ячейками — заголовок
        headers = cells;
        foundHeader = true;
      } else {
        // Строка данных — должна иметь столько же ячеек
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

    const data = parseDocumentData(doc);

    const reportFiles = [];
    let reportText = 'Отчёт сгенерирован на основе документа: ' + (doc.originalName || 'Неизвестный документ');

    if (data.empty) {
      reportText += '\n\n⚠️ Внимание: в документе не обнаружены структурированные таблицы. ' +
                    'Сгенерирован отчёт с метаданными документа. ' +
                    'Для полноценной аналитики загрузите документ с табличными данными (Excel, ведомость, баланс и т.п.).';
    }

    const reportsDir = path.join(__dirname, '../../public/reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const names = data.rows.map(r => r[0] || '—');
    const nets = data.rows.map(r => {
      const val = parseFloat(String(r[r.length - 1] || '0').replace(/\s/g, '').replace(',', '.'));
      return isNaN(val) ? 0 : val;
    });
    const accrued = data.rows.map(r => {
      const val = parseFloat(String(r[r.length - 2] || '0').replace(/\s/g, '').replace(',', '.'));
      return isNaN(val) ? 0 : val;
    });

    // 🔥 Можем генерить диаграммы только если есть реальные числовые данные
    const canGenerateCharts = !data.empty &&
                              nets.some(v => v > 0) &&
                              accrued.some(v => v > 0);

    // Генерация диаграмм
    if ((type === 'all' || type === 'charts') && canGenerateCharts) {
      try {
        const pieBuffer = generatePieChart(names, nets, 'Структура выплат по сотрудникам');
        const piePath = path.join(reportsDir, `chart-pie-${Date.now()}.png`);
        fs.writeFileSync(piePath, pieBuffer);
        reportFiles.push({ type: 'image', name: 'Круговая диаграмма (выплаты)', url: `/reports/${path.basename(piePath)}` });
      } catch (chartErr) {
        console.error('Pie chart error:', chartErr.message);
      }

      try {
        const barBuffer = generateBarChart(names, accrued, 'Начисления по сотрудникам', 'Сумма (руб.)');
        const barPath = path.join(reportsDir, `chart-bar-${Date.now()}.png`);
        fs.writeFileSync(barPath, barBuffer);
        reportFiles.push({ type: 'image', name: 'Столбчатая диаграмма (начисления)', url: `/reports/${path.basename(barPath)}` });
      } catch (chartErr) {
        console.error('Bar chart error:', chartErr.message);
      }
    } else if ((type === 'all' || type === 'charts') && !canGenerateCharts) {
      console.log('Пропуск генерации диаграмм: нет числовых данных');
    }

    // Генерация PDF
    if ((type === 'all' || type === 'pdf')) {
      try {
        const PDFDocument = require('pdfkit');
        const pdfDoc = new PDFDocument();
        const pdfPath = path.join(reportsDir, `report-${Date.now()}.pdf`);
        const stream = fs.createWriteStream(pdfPath);
        pdfDoc.pipe(stream);

        const fontPath = path.join(__dirname, '../../public/fonts/arial.ttf');
        if (fs.existsSync(fontPath)) {
          pdfDoc.registerFont('ArialCyrillic', fontPath);
          pdfDoc.font('ArialCyrillic');
        }

        const titleText = data.empty ? 'ОТЧЁТ ПО ДОКУМЕНТУ' : 'ОТЧЁТ ПО ЗАРАБОТНОЙ ПЛАТЕ';
        pdfDoc.fontSize(20).text(titleText, 50, 50);
        pdfDoc.fontSize(12).text('На основе документа: ' + (doc.originalName || 'Неизвестный'), 50, 80);

        if (data.empty) {
          pdfDoc.fontSize(10).fillColor('#888888').text(
            'Структурированные таблицы в документе не обнаружены. ' +
            'Отображены метаданные документа.',
            50, 105, { width: 500 }
          );
        }

        pdfDoc.moveDown(2);

        pdfDoc.fontSize(14).fillColor('#000000').text(
          data.empty ? 'СВЕДЕНИЯ О ДОКУМЕНТЕ' : 'ТАБЛИЦА РАСЧЁТА',
          50, 140
        );
        pdfDoc.moveDown();

        const tableTop = 180;
        const colWidth = data.empty ? 200 : 80;
        const headers = data.headers;

        pdfDoc.fontSize(10).fillColor('#333333');
        headers.forEach((header, i) => {
          pdfDoc.text(String(header), 50 + i * colWidth, tableTop);
        });

        data.rows.forEach((row, i) => {
          const y = tableTop + 25 + (i * 20);
          row.forEach((cell, j) => {
            pdfDoc.text(String(cell), 50 + j * colWidth, y, { width: colWidth - 10 });
          });
        });

        if (type === 'all' && canGenerateCharts) {
          pdfDoc.addPage();
          pdfDoc.fontSize(16).text('ДИАГРАММЫ', 50, 50);

          try {
            const pieBuffer = generatePieChart(names, nets, 'Структура выплат');
            pdfDoc.image(pieBuffer, 50, 80, { width: 500 });
          } catch (e) {
            console.error('PDF pie chart error:', e.message);
          }

          pdfDoc.addPage();
          try {
            const barBuffer = generateBarChart(names, accrued, 'Начисления по сотрудникам', 'Сумма (руб.)');
            pdfDoc.image(barBuffer, 50, 80, { width: 500 });
          } catch (e) {
            console.error('PDF bar chart error:', e.message);
          }
        }

        pdfDoc.end();

        await new Promise((resolve, reject) => {
          stream.on('finish', resolve);
          stream.on('error', reject);
        });

        console.log('PDF создан:', pdfPath);
        reportFiles.push({ type: 'pdf', name: 'Отчёт PDF', url: `/reports/${path.basename(pdfPath)}` });
      } catch (pdfErr) {
        console.error('PDF generation error:', pdfErr.message);
      }
    }

    // Генерация Excel
    if (type === 'all' || type === 'excel') {
      try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Отчёт');

        worksheet.columns = data.headers.map((h, i) => ({
          header: String(h),
          key: `col${i}`,
          width: data.empty ? 35 : 20
        }));

        worksheet.getRow(1).font = { bold: true, size: 12 };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        data.rows.forEach(row => worksheet.addRow(row));

        const excelPath = path.join(reportsDir, `report-${Date.now()}.xlsx`);
        await workbook.xlsx.writeFile(excelPath);
        reportFiles.push({ type: 'excel', name: 'Отчёт Excel', url: `/reports/${path.basename(excelPath)}` });
      } catch (excelErr) {
        console.error('Excel generation error:', excelErr.message);
      }
    }

    const result = {
      success: true,
      data: {
        text: reportText,
        files: reportFiles,
        empty: data.empty
      }
    };

    res.json(result);

  } catch (error) {
    console.error('Ошибка генерации отчёта:', error);
    res.status(500).json({ success: false, message: 'Ошибка при генерации отчёта: ' + error.message });
  }
};

module.exports = { generateReport, generatePieChart, generateBarChart }