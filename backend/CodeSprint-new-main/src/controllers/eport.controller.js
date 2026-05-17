const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const width = 800;
const height = 600;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

// Генерация круговой диаграммы
const generatePieChart = async (labels, data, title) => {
  const configuration = {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
        borderWidth: 1
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: title,
          font: { size: 18 }
        },
        legend: {
          position: 'bottom'
        }
      }
    }
  };
  const image = await chartJSNodeCanvas.renderToBuffer(configuration);
  return image;
};

// Генерация столбчатой диаграммы
const generateBarChart = async (labels, data, title, label) => {
  const configuration = {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        backgroundColor: '#36A2EB',
        borderColor: '#2E86C1',
        borderWidth: 1
      }]
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: title,
          font: { size: 18 }
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  };
  const image = await chartJSNodeCanvas.renderToBuffer(configuration);
  return image;
};

// Генерация Excel-файла
const generateExcel = async (data, filename) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Отчёт');

  // Заголовки
  worksheet.columns = [
    { header: 'Сотрудник', key: 'name', width: 20 },
    { header: 'Должность', key: 'position', width: 20 },
    { header: 'Оклад', key: 'salary', width: 15 },
    { header: 'Начислено', key: 'accrued', width: 15 },
    { header: 'НДФЛ 13%', key: 'ndfl', width: 15 },
    { header: 'К выплате', key: 'net', width: 15 }
  ];

  // Стили заголовков
  worksheet.getRow(1).font = { bold: true, size: 12 };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

  // Данные
  data.forEach(row => worksheet.addRow(row));

  // Итого
  const lastRow = worksheet.rowCount + 1;
  worksheet.mergeCells(`A${lastRow}:C${lastRow}`);
  worksheet.getCell(`A${lastRow}`).value = 'ИТОГО:';
  worksheet.getCell(`A${lastRow}`).font = { bold: true };
  worksheet.getCell(`D${lastRow}`).value = { formula: `SUM(D2:D${lastRow-1})` };
  worksheet.getCell(`E${lastRow}`).value = { formula: `SUM(E2:E${lastRow-1})` };
  worksheet.getCell(`F${lastRow}`).value = { formula: `SUM(F2:F${lastRow-1})` };

  const filePath = path.join(__dirname, '../../public/reports', filename);
  await workbook.xlsx.writeFile(filePath);
  return `/reports/${filename}`;
};

// Генерация PDF-отчёта
const generatePDF = async (data, charts, filename) => {
  const doc = new PDFDocument();
  const filePath = path.join(__dirname, '../../public/reports', filename);
  doc.pipe(fs.createWriteStream(filePath));

  // Заголовок
  doc.fontSize(20).text('ОТЧЁТ ПО ЗАРАБОТНОЙ ПЛАТЕ', 50, 50);
  doc.moveDown();

  // Таблица
  doc.fontSize(12);
  const tableTop = 100;
  const colWidth = 90;
  
  // Заголовки таблицы
  const headers = ['Сотрудник', 'Должность', 'Оклад', 'Начислено', 'НДФЛ', 'К выплате'];
  headers.forEach((header, i) => {
    doc.text(header, 50 + i * colWidth, tableTop);
  });

  // Данные
  data.forEach((row, i) => {
    const y = tableTop + 25 + (i * 20);
    doc.text(row.name, 50, y);
    doc.text(row.position, 50 + colWidth, y);
    doc.text(String(row.salary), 50 + colWidth * 2, y);
    doc.text(String(row.accrued), 50 + colWidth * 3, y);
    doc.text(String(row.ndfl), 50 + colWidth * 4, y);
    doc.text(String(row.net), 50 + colWidth * 5, y);
  });

  // Диаграммы
  if (charts && charts.length) {
    doc.addPage();
    doc.fontSize(16).text('ДИАГРАММЫ', 50, 50);
    
    charts.forEach((chartBuffer, i) => {
      if (i > 0) doc.addPage();
      doc.image(chartBuffer, 50, 100, { width: 500 });
    });
  }

  doc.end();
  return `/reports/${filename}`;
};

// Основной контроллер
const generateReport = async (req, res) => {
  try {
    const { documentId, type = 'all' } = req.body;
    
    if (!documentId) {
      return res.status(400).json({ success: false, message: 'Не передан ID документа' });
    }

    const doc = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Документ не найден' });
    }

    // Парсим данные из текста документа (упрощённо)
    // В реальности здесь должен быть более умный парсер
    const sampleData = [
      { name: 'Иванов И.И.', position: 'Разработчик', salary: 80000, accrued: 80000, ndfl: 10400, net: 69600 },
      { name: 'Петрова А.С.', position: 'Аналитик', salary: 70000, accrued: 63000, ndfl: 8190, net: 54810 },
      { name: 'Сидоров В.П.', position: 'Тестировщик', salary: 60000, accrued: 60000, ndfl: 7800, net: 52200 },
      { name: 'Козлова Е.М.', position: 'Менеджер', salary: 75000, accrued: 56250, ndfl: 7313, net: 48938 },
      { name: 'Новиков Д.А.', position: 'Стажёр', salary: 40000, accrued: 40000, ndfl: 5200, net: 34800 }
    ];

    const result = {
      success: true,
      data: {
        text: 'Отчёт сгенерирован на основе документа: ' + doc.originalName,
        files: []
      }
    };

    // Создаём папку для отчётов, если нет
    const reportsDir = path.join(__dirname, '../../public/reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Генерация диаграмм
    if (type === 'all' || type === 'charts') {
      const names = sampleData.map(d => d.name);
      const salaries = sampleData.map(d => d.accrued);
      const nets = sampleData.map(d => d.net);

      // Столбчатая диаграмма по начислениям
      const barChart = await generateBarChart(names, salaries, 'Начислено по сотрудникам', 'Сумма (руб.)');
      const barPath = path.join(reportsDir, `chart-bar-${Date.now()}.png`);
      fs.writeFileSync(barPath, barChart);
      result.data.files.push({ type: 'image', name: 'Диаграмма начислений', url: `/reports/${path.basename(barPath)}` });

      // Круговая диаграмма по к выплате
      const pieChart = await generatePieChart(names, nets, 'Структура к выплате');
      const piePath = path.join(reportsDir, `chart-pie-${Date.now()}.png`);
      fs.writeFileSync(piePath, pieChart);
      result.data.files.push({ type: 'image', name: 'Диаграмма выплат', url: `/reports/${path.basename(piePath)}` });
    }

    // Генерация Excel
    if (type === 'all' || type === 'excel') {
      const excelUrl = await generateExcel(sampleData, `report-${Date.now()}.xlsx`);
      result.data.files.push({ type: 'excel', name: 'Отчёт Excel', url: excelUrl });
    }

    // Генерация PDF
    if (type === 'all' || type === 'pdf') {
      const charts = [];
      if (type === 'all') {
        const names = sampleData.map(d => d.name);
        const salaries = sampleData.map(d => d.accrued);
        const barChart = await generateBarChart(names, salaries, 'Начислено по сотрудникам', 'Сумма (руб.)');
        charts.push(barChart);
      }
      const pdfUrl = await generatePDF(sampleData, charts, `report-${Date.now()}.pdf`);
      result.data.files.push({ type: 'pdf', name: 'Отчёт PDF', url: pdfUrl });
    }

    res.json(result);

  } catch (error) {
    console.error('Ошибка генерации отчёта:', error);
    res.status(500).json({ success: false, message: 'Ошибка при генерации отчёта' });
  }
};

module.exports = { generateReport, generatePieChart, generateBarChart, generateExcel, generatePDF };