const ExcelJS = require('exceljs');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const path = require('path');
const fs = require('fs');

const width = 800;
const height = 500;
const chartCanvas = new ChartJSNodeCanvas({ width, height });

class ReportService {
    async generateReport(document, type = 'all') {
        const data = this.parseDocumentData(document);
        const reportData = this.buildReportData(data, type);
        
        const excelFileName = `report_${document.id}_${Date.now()}.xlsx`;
        const excelPath = path.join(__dirname, '../../public/reports', excelFileName);
        await this.generateExcel(reportData, excelPath);
        
        return {
            text: reportData.text,
            tables: reportData.tables,
            images: reportData.images,
            attachments: [{
                name: excelFileName,
                url: `/reports/${excelFileName}`,
                type: 'excel'
            }],
            excelPath
        };
    }

    parseDocumentData(document) {
        let headers = [];
        let rows = [];
        
        if (!document.extractedText) {
            return { headers: ['Данные'], rows: [['Нет данных']], columns: [], rawText: '' };
        }

        const text = document.extractedText;
        
        // Стратегия 1: DOCX таблица с \n\n разделителями (ячейки идут вертикально)
        // Формат: № \n\n ФИО \n\n Должность \n\n ... \n\n 1 \n\n Иванов \n\n Разработчик \n\n ...
        const cells = text.split(/\n\s*\n/).map(c => c.trim()).filter(c => c.length > 0);
        
        // Ищем паттерн: заголовки после "№", затем данные по 9 ячеек на строку
        const tableStructure = this.parseVerticalTable(cells);
        if (tableStructure.rows.length > 0) {
            headers = tableStructure.headers;
            rows = tableStructure.rows;
        }
        
        // Стратегия 2: Если не сработало — пробуем построчный парсинг
        if (rows.length === 0) {
            const tableStructure2 = this.parseHorizontalTable(text);
            if (tableStructure2.rows.length > 0) {
                headers = tableStructure2.headers;
                rows = tableStructure2.rows;
            }
        }

        // Fallback
        if (rows.length === 0) {
            return {
                headers: ['Содержимое документа'],
                rows: [[text.substring(0, 1000).replace(/\n/g, ' ')]],
                columns: [],
                rawText: text
            };
        }

        return { headers, rows, columns: [], rawText: text };
    }

    parseVerticalTable(cells) {
        // DOCX таблица: ячейки идут вертикально (сверху вниз, затем следующая колонка)
        // Или: заголовки в одну строку, затем данные построчно
        
        // Ищем "№" — начало таблицы
        let startIdx = cells.findIndex(c => c === '№' || c.startsWith('№'));
        if (startIdx === -1) return { headers: [], rows: [] };
        
        // Определяем структуру: сколько колонок
        // Стандартная зарплатная ведомость: 9 колонок
        const standardHeaders = ['№', 'ФИО', 'Должность', 'Оклад (руб.)', 'Отработано дней', 'Начислено (руб.)', 'НДФЛ 13% (руб.)', 'Удержано (руб.)', 'К выплате (руб.)'];
        
        // Проверяем, следуют ли после "№" заголовки
        let colCount = 9;
        let headers = [];
        
        if (startIdx + 8 < cells.length) {
            // Проверяем, похожи ли следующие ячейки на заголовки
            const possibleHeaders = cells.slice(startIdx, startIdx + 9);
            const looksLikeHeaders = possibleHeaders.some(h => 
                ['ФИО', 'Должность', 'Оклад', 'Начислено', 'НДФЛ'].some(k => h.includes(k))
            );
            
            if (looksLikeHeaders) {
                headers = possibleHeaders;
                startIdx += 9;
            } else {
                headers = standardHeaders;
                startIdx += 1; // Только пропускаем "№"
            }
        } else {
            headers = standardHeaders;
            startIdx += 1;
        }
        
        // Собираем строки данных
        // Каждая строка = colCount ячеек
        const rows = [];
        for (let i = startIdx; i < cells.length; i += colCount) {
            const row = cells.slice(i, i + colCount);
            // Проверяем, что это реальная строка данных (начинается с числа)
            if (row.length >= 3 && /^\d+$/.test(row[0])) {
                rows.push(row);
            } else if (row.length >= 3 && row[0] !== 'Показатель' && !row[0].includes('ПОДПИСИ')) {
                // Возможно это вторая таблица (итоги)
                break;
            }
        }
        
        return { headers, rows };
    }

    parseHorizontalTable(text) {
        // Построчный парсинг: каждая строка = одна запись
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const rows = [];
        let headers = [];
        let foundHeader = false;
        
        for (const line of lines) {
            // Пропускаем служебные строки
            if (line.includes('ПОДПИСИ') || line.includes('Расчёт составил') || 
                line.includes('Проверил') || line.includes('Утверждаю') ||
                line.includes('____')) continue;
            
            // Разбиваем по 2+ пробелам или табуляции
            const cells = line.split(/\s{2,}|\t/).map(c => c.trim()).filter(c => c);
            
            if (cells.length >= 3 && cells.length <= 10) {
                if (!foundHeader && cells[0] === '№') {
                    // Это заголовок
                    headers = cells;
                    foundHeader = true;
                } else if (/^\d+$/.test(cells[0]) && cells.length >= 3) {
                    // Это строка данных (начинается с номера)
                    rows.push(cells);
                }
            }
        }
        
        if (headers.length === 0 && rows.length > 0) {
            // Стандартные заголовки
            headers = ['№', 'ФИО', 'Должность', 'Оклад (руб.)', 'Отработано дней', 'Начислено (руб.)', 'НДФЛ 13% (руб.)', 'Удержано (руб.)', 'К выплате (руб.)'];
            headers = headers.slice(0, rows[0].length);
        }
        
        return { headers, rows };
    }

    buildReportData(data, type) {
        const tables = [];
        const images = [];
        let text = '';

        if (type === 'all' || type === 'summary') {
            const metrics = this.calculateMetrics(data);
            const metricRows = Object.entries(metrics).map(([k, v]) => [k, v]);
            
            tables.push({
                title: 'Сводные метрики',
                headers: ['Метрика', 'Значение'],
                rows: metricRows,
                totals: ['Всего строк', data.rows?.length || 0]
            });
            
            text = `Отчёт по документу: ${data.rows?.length || 0} строк, ${data.headers?.length || 0} колонок.`;
        }

        if (type === 'all' || type === 'summary') {
            const previewRows = (data.rows || []).slice(0, 20);
            if (previewRows.length) {
                tables.push({
                    title: 'Данные (первые 20 строк)',
                    headers: data.headers || [],
                    rows: previewRows,
                    totals: null
                });
            }
        }

        if (type === 'all' || type === 'charts') {
            const chartImages = this.generateCharts(data);
            images.push(...chartImages);
        }

        return { text, tables, images };
    }

    calculateMetrics(data) {
        const metrics = {};
        if (!data.rows || !data.headers) return metrics;

        data.headers.forEach((header, idx) => {
            const values = data.rows
                .map(r => {
                    const val = r[idx];
                    if (val === undefined || val === null || val === '') return NaN;
                    const num = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
                    return num;
                })
                .filter(v => !isNaN(v));
            
            if (values.length) {
                const sum = values.reduce((a, b) => a + b, 0);
                metrics[`${header} (SUM)`] = sum.toFixed(2);
                metrics[`${header} (AVG)`] = (sum / values.length).toFixed(2);
                metrics[`${header} (MIN)`] = Math.min(...values).toFixed(2);
                metrics[`${header} (MAX)`] = Math.max(...values).toFixed(2);
                metrics[`${header} (COUNT)`] = values.length;
            }
        });

        return metrics;
    }

    generateCharts(data) {
        const images = [];
        if (!data.rows || !data.headers || data.rows.length < 2) return images;

        const numericCols = [];
        data.headers.forEach((h, i) => {
            const vals = data.rows.slice(0, Math.min(10, data.rows.length))
                .map(r => {
                    const val = r[i];
                    if (!val) return NaN;
                    const num = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
                    return num;
                })
                .filter(v => !isNaN(v));
            if (vals.length >= 3) numericCols.push({ header: h, index: i });
        });

        if (numericCols.length >= 1) {
            const col = numericCols[0];
            const rowCount = Math.min(10, data.rows.length);
            const labels = data.rows.slice(0, rowCount).map((r, i) => {
                const nameIdx = data.headers.findIndex(h => h.includes('ФИО'));
                if (nameIdx >= 0 && r[nameIdx]) {
                    return String(r[nameIdx]).substring(0, 15);
                }
                return `Сотрудник ${i + 1}`;
            });
            const values = data.rows.slice(0, rowCount).map(r => {
                const val = r[col.index];
                if (!val) return 0;
                return parseFloat(String(val).replace(/\s/g, '').replace(',', '.')) || 0;
            });

            const config = {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: col.header,
                        data: values,
                        backgroundColor: 'rgba(74, 222, 128, 0.6)',
                        borderColor: 'rgba(74, 222, 128, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    plugins: { 
                        title: { display: true, text: col.header, color: '#e0e0e0' },
                        legend: { labels: { color: '#e0e0e0' } }
                    },
                    scales: { 
                        y: { beginAtZero: true, ticks: { color: '#b0b0b0' } },
                        x: { ticks: { color: '#b0b0b0' } }
                    }
                }
            };

            try {
                const buffer = chartCanvas.renderToBufferSync(config);
                const base64 = buffer.toString('base64');
                images.push({
                    name: `chart_${col.header}.png`,
                    dataUrl: `data:image/png;base64,${base64}`
                });
            } catch (e) {
                console.error('Chart error:', e);
            }
        }

        if (numericCols.length >= 2) {
            const col = numericCols[1];
            const rowCount = Math.min(5, data.rows.length);
            const labels = data.rows.slice(0, rowCount).map((r, i) => {
                const nameIdx = data.headers.findIndex(h => h.includes('ФИО'));
                if (nameIdx >= 0 && r[nameIdx]) {
                    return String(r[nameIdx]).substring(0, 15);
                }
                return `Сотр. ${i + 1}`;
            });
            const values = data.rows.slice(0, rowCount).map(r => {
                const val = r[col.index];
                if (!val) return 0;
                return parseFloat(String(val).replace(/\s/g, '').replace(',', '.')) || 0;
            });

            const pieConfig = {
                type: 'pie',
                data: {
                    labels,
                    datasets: [{
                        data: values,
                        backgroundColor: [
                            'rgba(74, 222, 128, 0.7)',
                            'rgba(96, 165, 250, 0.7)',
                            'rgba(251, 146, 60, 0.7)',
                            'rgba(232, 121, 249, 0.7)',
                            'rgba(250, 204, 21, 0.7)'
                        ]
                    }]
                },
                options: {
                    plugins: { 
                        title: { display: true, text: `Распределение: ${col.header}`, color: '#e0e0e0' },
                        legend: { labels: { color: '#e0e0b0' } }
                    }
                }
            };

            try {
                const buffer = chartCanvas.renderToBufferSync(pieConfig);
                const base64 = buffer.toString('base64');
                images.push({
                    name: `pie_${col.header}.png`,
                    dataUrl: `data:image/png;base64,${base64}`
                });
            } catch (e) {
                console.error('Pie chart error:', e);
            }
        }

        return images;
    }

    async generateExcel(reportData, filePath) {
        const workbook = new ExcelJS.Workbook();
        
        const summarySheet = workbook.addWorksheet('Сводка');
        summarySheet.addRow(['📊 Отчёт DocMind']);
        summarySheet.addRow([]);
        
        if (reportData.text) {
            summarySheet.addRow([reportData.text]);
            summarySheet.addRow([]);
        }

        for (const table of reportData.tables) {
            const safeTitle = table.title.substring(0, 31).replace(/[\\/*?:[\]]/g, '_');
            const sheet = workbook.addWorksheet(safeTitle);
            
            const headerRow = sheet.addRow(table.headers);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF3A3A3A' }
            };
            
            for (const row of table.rows) {
                sheet.addRow(row);
            }
            
            if (table.totals) {
                sheet.addRow([]);
                const totalRow = sheet.addRow(table.totals.map(t => String(t)));
                totalRow.font = { bold: true };
                totalRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF2A2A2A' }
                };
            }
            
            sheet.columns.forEach(column => {
                let maxLength = 10;
                column.eachCell({ includeEmpty: false }, cell => {
                    const length = String(cell.value || '').length;
                    if (length > maxLength) maxLength = length;
                });
                column.width = Math.min(maxLength + 2, 50);
            });
        }

        if (reportData.images && reportData.images.length) {
            const chartSheet = workbook.addWorksheet('Диаграммы');
            let currentRow = 1;
            
            for (const img of reportData.images) {
                const base64Data = img.dataUrl.replace('data:image/png;base64,', '');
                const imageId = workbook.addImage({
                    base64: base64Data,
                    extension: 'png'
                });
                
                chartSheet.addImage(imageId, {
                    tl: { col: 0, row: currentRow },
                    ext: { width: 600, height: 375 }
                });
                
                currentRow += 25;
            }
        }

        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await workbook.xlsx.writeFile(filePath);
        return filePath;
    }
}

module.exports = new ReportService();