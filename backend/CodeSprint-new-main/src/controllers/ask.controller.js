const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const http = require('http');
const https = require('https');
const { generateBarChart, generatePieChart } = require('./report.controller');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const httpAgent = new http.Agent({ keepAlive: false });
const httpsAgent = new https.Agent({ keepAlive: false });

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'baidu/cobuddy:free';

async function axiosPostWithRetry(url, data, headers, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await axios.post(url, data, {
        headers,
        timeout: 60000,
        httpAgent,
        httpsAgent
      });
    } catch (err) {
      lastError = err;
      const isRetryable = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EPIPE'].includes(err.code);
      const isServerError = err.response && err.response.status >= 500;
      const isNotFound = err.response && err.response.status === 404;
      const isRateLimit = err.response && err.response.status === 429;
      
      if (isNotFound || isRateLimit) throw err;
      if (!isRetryable && !isServerError) throw err;
      
      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`[OpenRouter] Попытка ${attempt} неудачна (${err.code || err.message}). Повтор через ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// Генерация диаграмм из данных документа
async function generateChartsFromDocument(doc) {
  const text = doc.extractedText || '';
  const charts = [];
  
  // Парсим числа из текста
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
  
  if (tables.length === 0) return charts;
  
  const table = tables[0];
  const headers = table[0] || [];
  const rows = table.slice(1) || [];
  
  // Ищем колонки с ФИО и числовыми значениями
  const nameIdx = headers.findIndex(h => h.includes('ФИО') || h.includes('Сотрудник'));
  const numericCols = [];
  
  headers.forEach((h, i) => {
    if (i === nameIdx) return;
    const vals = rows.slice(0, 10).map(r => {
      const val = r[i];
      if (!val) return NaN;
      const num = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
      return num;
    }).filter(v => !isNaN(v));
    if (vals.length >= 2) numericCols.push({ header: h, index: i });
  });
  
  const names = rows.map(r => r[nameIdx] || r[0] || '—').slice(0, 10);
  
  // Бар-чарт по первой числовой колонке
  if (numericCols.length >= 1) {
    const col = numericCols[0];
    const values = rows.slice(0, 10).map(r => {
      const val = r[col.index];
      return parseFloat(String(val).replace(/\s/g, '').replace(',', '.')) || 0;
    });
    try {
      const buffer = generateBarChart(names, values, col.header, 'Сумма (руб.)');
      charts.push({
        type: 'bar',
        title: col.header,
        base64: buffer.toString('base64')
      });
    } catch (e) {
      console.error('Bar chart error:', e);
    }
  }
  
  // Pie-чарт по второй числовой колонке (к выплате / НДФЛ)
  if (numericCols.length >= 2) {
    const col = numericCols[1];
    const values = rows.slice(0, 10).map(r => {
      const val = r[col.index];
      return parseFloat(String(val).replace(/\s/g, '').replace(',', '.')) || 0;
    });
    try {
      const buffer = generatePieChart(names, values, col.header);
      charts.push({
        type: 'pie',
        title: col.header,
        base64: buffer.toString('base64')
      });
    } catch (e) {
      console.error('Pie chart error:', e);
    }
  }
  
  return charts;
}

const askQuestion = async (req, res, next) => {
  try {
    const { question, documentId, documentIds } = req.body;
    if (!question) {
      return res.status(400).json({ success: false, message: 'Вопрос обязателен' });
    }

    const ids = [];
    if (Array.isArray(documentIds) && documentIds.length) {
      ids.push(...documentIds);
    } else if (documentId) {
      ids.push(documentId);
    }
    const uniqueIds = [...new Set(ids)];

    if (!uniqueIds.length) {
      return res.status(400).json({ success: false, message: 'Не передан ID документа' });
    }

    const docs = await prisma.document.findMany({
      where: { id: { in: uniqueIds } }
    });
    if (!docs.length) {
      return res.status(404).json({ success: false, message: 'Документы не найдены' });
    }

    let combinedText = '';
    const foundNames = [];
    for (const doc of docs) {
      if (doc.extractedText && doc.extractedText.trim()) {
        combinedText += '\n\n=== Документ: ' + doc.originalName + ' ===\n' + doc.extractedText;
        foundNames.push(doc.originalName);
      }
    }
    if (!combinedText.trim()) {
      return res.status(404).json({ success: false, message: 'Текст из документов не удалось извлечь' });
    }

    const trimmedText = combinedText.substring(0, 120000);
    const docsLabel = foundNames.length === 1
      ? 'документа "' + foundNames[0] + '"'
      : foundNames.length + ' документов: ' + foundNames.join(', ');

    // Проверяем, просит ли пользователь диаграмму
    const lowerQuestion = question.toLowerCase();
    const wantsChart = lowerQuestion.includes('диаграмм') || lowerQuestion.includes('график') || 
                       lowerQuestion.includes('chart') || lowerQuestion.includes('визуализ');

    const systemPrompt = `Ты — профессиональный AI-ассистент для бухгалтеров и экономистов. Отвечай на вопросы ТОЛЬКО на основе предоставленного текста из ${docsLabel}.

ПРАВИЛА ФОРМАТИРОВАНИЯ ОТВЕТА:
1. Заголовки выделяй ПРОПИСНЫМИ БУКВАМИ или через линии ===
2. Таблицы оформляй через символы псевдографики: | - + 
3. Списки оформляй через • или ->
4. Важные цифры и суммы выделяй [ ] скобками
5. Разделители между блоками делай через линию ---------------
6. НЕ используй символы #, *, _, \` и другой Markdown
7. Если информации нет — ответь ТОЧНО: [Информация отсутствует в загруженных файлах]
8. Не придумывай ничего от себя
9. Отвечай развернуто, красиво и по делу
10. Для бухгалтерских расчётов показывай промежуточные шаги
11. Указывай статьи НК РФ и другие нормативные акты, если они упоминаются в документе

Текст документов:
${trimmedText}`;

    console.log(`[OpenRouter] Запрос к модели: ${DEFAULT_MODEL}, документов: ${foundNames.length}`);

    const requestBody = {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.1,
      max_tokens: 4000
    };

    if (lowerQuestion.includes('расчёт') || lowerQuestion.includes('вычисли') || 
        lowerQuestion.includes('сколько') || lowerQuestion.includes('посчитай') ||
        lowerQuestion.includes('анализ') || lowerQuestion.includes('проверь')) {
      requestBody.reasoning = { effort: 'medium' };
    }

    const response = await axiosPostWithRetry(
      'https://openrouter.ai/api/v1/chat/completions',
      requestBody,
      {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OPENROUTER_API_KEY,
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'DocMind Pro'
      }
    );

    let answer = response.data.choices[0].message.content;

    // Если просили диаграмму — генерируем настоящие изображения
    let charts = [];
    if (wantsChart && docs.length > 0) {
      charts = await generateChartsFromDocument(docs[0]);
      if (charts.length > 0) {
        // Добавляем ссылки на диаграммы в ответ
        answer += '\n\n=== ГЕНЕРИРОВАННЫЕ ДИАГРАММЫ ===\n';
        charts.forEach((chart, i) => {
          answer += `\n[Диаграмма ${i + 1}: ${chart.title}]\n`;
        });
      }
    }

    if (response.data.usage && response.data.usage.reasoning_tokens) {
      console.log(`[OpenRouter] Reasoning tokens: ${response.data.usage.reasoning_tokens}`);
    }

    for (const doc of docs) {
      try {
        await prisma.questionAnswer.create({
          data: {
            documentId: doc.id,
            question,
            answer,
            sourceChunk: trimmedText.substring(0, 500)
          }
        });
      } catch (e) {
        console.log('Ошибка сохранения Q&A:', e.message);
      }
    }

    res.json({
      success: true,
      data: {
        answer,
        charts: charts.map(c => ({ type: c.type, title: c.title, base64: c.base64 })),
        documentsUsed: foundNames.length,
        documentNames: foundNames
      }
    });
  } catch (error) {
    console.error('Критическая ошибка OpenRouter:', error.message);
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      console.error('Ответ OpenRouter:', status, JSON.stringify(data));
      
      if (status === 404) {
        return res.status(502).json({
          success: false,
          message: `Модель ${DEFAULT_MODEL} не найдена (404). Проверьте API ключ или выберите другую модель в .env`
        });
      }
      if (status === 429) {
        return res.status(429).json({
          success: false,
          message: 'Превышен лимит запросов к OpenRouter (429). Подождите немного и повторите.'
        });
      }
      if (status === 401) {
        return res.status(401).json({
          success: false,
          message: 'Невалидный API ключ OpenRouter (401). Проверьте OPENROUTER_API_KEY в .env'
        });
      }
    }
    
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return res.status(502).json({
        success: false,
        message: 'Не удалось подключиться к нейросети (ошибка соединения). Пожалуйста, повторите запрос позже.'
      });
    }
    
    res.status(500).json({ success: false, message: 'Ошибка при обращении к нейросети: ' + error.message });
  }
};

module.exports = { askQuestion };