const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'docmind-secret-key-change-in-production';

function getUserIdFromReq(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    try {
        return jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET).userId;
    } catch { return null; }
}

// POST /api/commands/run
router.post('/run', async (req, res) => {
    try {
        const { command, documentId, params = {} } = req.body;

        if (!command || !documentId) {
            return res.status(400).json({ success: false, error: 'Команда и ID документа обязательны' });
        }

        const userId = getUserIdFromReq(req);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Требуется авторизация' });
        }

        const doc = await prisma.document.findFirst({ where: { id: documentId, userId } });
        if (!doc) {
            return res.status(404).json({ success: false, error: 'Документ не найден или нет доступа' });
        }

        let result = {};

        switch (command) {
            case 'analyze':
                result = await runAnalyze(doc, params);
                break;
            case 'summary':
                result = await runSummary(doc, params);
                break;
            case 'report':
                result = await runReport(doc, params);
                break;
            case 'chart':
                result = await runChart(doc, params);
                break;
            case 'excel':
                result = await runExport(doc, 'excel', params);
                break;
            case 'pdf':
                result = await runExport(doc, 'pdf', params);
                break;
            case 'extract':
                result = await runExtract(doc, params);
                break;
            case 'salary':
                result = await runSalaryCalc(doc, params);
                break;
            case 'tax':
                result = await runTaxCalc(doc, params);
                break;
            case 'balance':
                result = await runBalance(doc, params);
                break;
            case 'audit':
                result = await runAudit(doc, params);
                break;
            default:
                return res.status(400).json({ success: false, error: 'Неизвестная команда: ' + command });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Command error:', error);
        res.status(500).json({ success: false, error: 'Ошибка выполнения команды: ' + error.message });
    }
});

async function runAnalyze(doc, params) {
    const text = doc.extractedText || '';
    const lines = text.split('\n').filter(l => l.trim());
    const words = text.split(/\s+/).filter(w => w.length > 0);

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

    const numbers = [];
    const numberMatches = text.match(/[\d\s.,]+/g) || [];
    numberMatches.forEach(m => {
        const num = parseFloat(m.replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(num) && num > 0) numbers.push(num);
    });

    const dates = [];
    const dateMatches = text.match(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/g) || [];
    dates.push(...dateMatches);

    const analysis = {
        text: `📊 Анализ документа "${doc.originalName}"\n\n` +
              `📄 Тип: ${doc.mimeType}\n` +
              `📦 Размер: ${(doc.size / 1024).toFixed(1)} KB\n` +
              `📊 Строк: ${lines.length}\n` +
              `📝 Слов: ${words.length}\n` +
              `🔢 Чисел найдено: ${numbers.length}\n` +
              `📅 Дат найдено: ${dates.length}\n` +
              `📋 Таблиц найдено: ${tables.length}\n\n` +
              `${numbers.length > 0 ? '💰 Основные суммы: ' + numbers.slice(0, 5).map(n => n.toLocaleString('ru-RU')).join(', ') + '\n\n' : ''}` +
              `${dates.length > 0 ? '📅 Основные даты: ' + dates.slice(0, 5).join(', ') + '\n\n' : ''}` +
              `${tables.length > 0 ? '✅ Обнаружены табличные данные — можно построить отчёты и диаграммы!' : 'ℹ️ Табличные данные не обнаружены.'}`,
        tables: tables.slice(0, 3),
        numbers: numbers.slice(0, 20),
        dates: dates.slice(0, 10)
    };

    return { text: analysis.text };
}

async function runSummary(doc, params) {
    const text = doc.extractedText || '';
    const lines = text.split('\n').filter(l => l.trim());
    const firstLines = lines.slice(0, 10).join('\n');

    const summary = `📝 Краткое содержание документа "${doc.originalName}"\n\n` +
                   `📄 Первые строки:\n${firstLines}\n\n` +
                   `📊 Всего строк: ${lines.length}\n` +
                   `✅ Документ загружен и готов к анализу.`;

    return { text: summary };
}

async function runReport(doc, params) {
    return { text: `📈 Для генерации полного отчёта используйте кнопку "Отчёт" в панели команд или напишите "сделай отчёт".` };
}

async function runChart(doc, params) {
    return { text: `📉 Для построения диаграммы используйте кнопку "Диаграмма" в панели команд или напишите "построй график".` };
}

async function runExport(doc, type, params) {
    return { text: `📦 Для экспорта в ${type.toUpperCase()} используйте соответствующую кнопку в панели команд.` };
}

async function runExtract(doc, params) {
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
        return { text: '🔢 Таблицы не обнаружены в документе.' };
    }

    let html = '<div class="report-card"><div class="report-header"><h3 class="report-title">🔢 Извлечённые таблицы</h3></div><div class="report-body">';
    tables.forEach((table, ti) => {
        html += '<div class="report-table-container"><h4 class="report-table-title">Таблица ' + (ti + 1) + '</h4>';
        html += '<table class="report-table"><thead><tr>';
        table[0].forEach(h => html += '<th>' + h + '</th>');
        html += '</tr></thead><tbody>';
        table.slice(1).forEach(row => {
            html += '<tr>';
            row.forEach(cell => html += '<td>' + cell + '</td>');
            html += '</tr>';
        });
        html += '</tbody></table></div>';
    });
    html += '</div></div>';

    return { html: html };
}

async function runSalaryCalc(doc, params) {
    const text = doc.extractedText || '';
    const salaryMatches = text.match(/(?:оклад|зарплата|начислено|выплата)[\s:]*(\d[\d\s.,]*)/gi) || [];
    const numbers = [];
    salaryMatches.forEach(m => {
        const num = parseFloat(m.replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!isNaN(num) && num > 1000) numbers.push(num);
    });

    let result = '💰 Расчёт зарплаты\n\n';
    if (numbers.length > 0) {
        const total = numbers.reduce((a, b) => a + b, 0);
        const ndfl = total * 0.13;
        const net = total - ndfl;
        result += `📊 Начислено: ${total.toLocaleString('ru-RU')} ₽\n`;
        result += `🏛️ НДФЛ (13%): ${ndfl.toLocaleString('ru-RU')} ₽\n`;
        result += `💵 К выплате: ${net.toLocaleString('ru-RU')} ₽\n\n`;
        result += `✅ Расчёт выполнен на основе данных документа.`;
    } else {
        result += 'ℹ️ Данные о зарплате не найдены в документе.\n\n';
        result += '💡 Попробуйте загрузить ведомость или расчётный лист.';
    }

    return { text: result };
}

async function runTaxCalc(doc, params) {
    const text = doc.extractedText || '';
    const numbers = [];
    const matches = text.match(/\d[\d\s.,]*/g) || [];
    matches.forEach(m => {
        const num = parseFloat(m.replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(num) && num > 1000) numbers.push(num);
    });

    let result = '🏛️ Налоговый расчёт\n\n';
    if (numbers.length > 0) {
        const income = numbers[0];
        const ndfl = income * 0.13;
        const insurance = income * 0.30;
        result += `📊 Доход: ${income.toLocaleString('ru-RU')} ₽\n`;
        result += `🏛️ НДФЛ (13%): ${ndfl.toLocaleString('ru-RU')} ₽\n`;
        result += `🛡️ Страховые взносы (~30%): ${insurance.toLocaleString('ru-RU')} ₽\n`;
        result += `💵 Чистый доход: ${(income - ndfl).toLocaleString('ru-RU')} ₽\n\n`;
        result += `⚠️ Это оценочный расчёт. Для точного расчёта обратитесь к бухгалтеру.`;
    } else {
        result += 'ℹ️ Данные для налогового расчёта не найдены.';
    }

    return { text: result };
}

async function runBalance(doc, params) {
    return { text: '⚖️ Баланс проводок\n\nℹ️ Функция в разработке. Загрузите бухгалтерский баланс для анализа.' };
}

async function runAudit(doc, params) {
    const text = doc.extractedText || '';
    const issues = [];

    if (!text.includes('ИНН') && !text.includes('КПП')) {
        issues.push('⚠️ Не обнаружены реквизиты организации (ИНН/КПП)');
    }
    if (!text.match(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/)) {
        issues.push('⚠️ Не обнаружены даты в документе');
    }
    if (text.includes('ошибка') || text.includes('неверно') || text.includes('неправильно')) {
        issues.push('⚠️ В тексте обнаружены слова об ошибках');
    }

    let result = '🔍 Аудит документа\n\n';
    if (issues.length > 0) {
        result += '❌ Обнаружены замечания:\n\n';
        issues.forEach(i => result += i + '\n');
    } else {
        result += '✅ Критических замечаний не обнаружено.\n';
    }
    result += `\n📄 Проверено: ${doc.originalName}`;

    return { text: result };
}

module.exports = router;