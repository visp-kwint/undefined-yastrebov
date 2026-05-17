const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

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
  const lines = text.split('\n').filter(l => l.trim());

  const tables = [];
  let currentTable = [];

  lines.forEach(line => {
    const cells = line.split(/\s{2,}|\t|,|;/).map(c => c.trim()).filter(c => c);
    if (cells.length >= 2 && cells.length <= 12) {
      currentTable.push(cells);
    } else if (currentTable.length > 0) {
      if (currentTable.length > 1) tables.push([...currentTable]);
      currentTable = [];
    }
  });
  if (currentTable.length > 1) tables.push(currentTable);

  if (tables.length === 0) {
    return {
      headers: ['Сотрудник', 'Должность', 'Оклад', 'Начислено', 'НДФЛ', 'К выплате'],
      rows: [
        ['Иванов И.И.', 'Разработчик', '80000', '80000', '10400', '69600'],
        ['Петрова А.С.', 'Аналитик', '70000', '63000', '8190', '54810'],
        ['Сидоров В.П.', 'Тестировщик', '60000', '60000', '7800', '52200'],
        ['Козлова Е.М.', 'Менеджер', '75000', '56250', '7313', '48938'],
        ['Новиков Д.А.', 'Стажёр', '40000', '40000', '5200', '34800']
      ]
    };
  }

  const table = tables[0];
  return {
    headers: table[0] || [],
    rows: table.slice(1) || []
  };
}

// ========== Основной контроллер ==========
const generateReport = async (req, res) => {
  try {
    const { documentId, type = 'all' } = req.body;

    if (!documentId) {
      return res.status(400).json({ success: false, message: 'Не передан ID документа' });
    }

    console.log('Ищем документ с ID:', documentId);

    const doc = await prisma.document.findUnique({
      where: { id: documentId }
    });

    console.log('Найден документ:', doc ? doc.originalName : 'не найден');

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Документ не найден' });
    }

    const data = parseDocumentData(doc);

    // Безопасная сборка результата: массив файлов собираем отдельно
    const reportFiles = [];
    const reportText = 'Отчёт сгенерирован на основе документа: ' + (doc.originalName || 'Неизвестный документ');

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

    // Генерация диаграмм
    if (type === 'all' || type === 'charts') {
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
    }

    // Генерация PDF
    if (type === 'all' || type === 'pdf') {
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

        pdfDoc.fontSize(20).text('ОТЧЁТ ПО ЗАРАБОТНОЙ ПЛАТЕ', 50, 50);
        pdfDoc.fontSize(12).text('На основе документа: ' + (doc.originalName || 'Неизвестный'), 50, 80);
        pdfDoc.moveDown(2);

        pdfDoc.fontSize(14).text('ТАБЛИЦА РАСЧЁТА', 50, 120);
        pdfDoc.moveDown();

        const tableTop = 160;
        const colWidth = 80;
        const headers = data.headers;

        pdfDoc.fontSize(10).fillColor('#333333');
        headers.forEach((header, i) => {
          pdfDoc.text(header, 50 + i * colWidth, tableTop);
        });

        data.rows.forEach((row, i) => {
          const y = tableTop + 25 + (i * 20);
          row.forEach((cell, j) => {
            pdfDoc.text(String(cell), 50 + j * colWidth, y);
          });
        });

        if (type === 'all') {
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
          header: h,
          key: `col${i}`,
          width: 20
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

    // Финальный ответ — собираем ОДИН раз, исключая undefined
    const result = {
      success: true,
      data: {
        text: reportText,
        files: reportFiles
      }
    };

    res.json(result);

  } catch (error) {
    console.error('Ошибка генерации отчёта:', error);
    res.status(500).json({ success: false, message: 'Ошибка при генерации отчёта: ' + error.message });
  }
};

module.exports = { generateReport, generatePieChart, generateBarChart }