const fs = require('fs');
const path = require('path');

// === OpenRouter ===
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const PRIMARY_MODEL = process.env.OPENROUTER_MODEL || 'baidu/cobuddy:free';
const FALLBACK_MODELS = (process.env.OPENROUTER_FALLBACK_MODELS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const OR_TEXT_MODELS = [PRIMARY_MODEL, ...FALLBACK_MODELS]
  .filter((m, i, arr) => m && arr.indexOf(m) === i);

const SYSTEM_PROMPT = `Ты — профессиональный парсер финансовых и бухгалтерских документов.
  Твоя задача — извлечь СТРУКТУРИРОВАННЫЕ табличные данные из текста (часто полученного через OCR с ошибками).
  
  ═══════════════════════════════════════
  ФОРМАТ ОТВЕТА — СТРОГО ЭТОТ JSON:
  ═══════════════════════════════════════
  {
    "title": "Краткое осмысленное название (например: 'Бухгалтерский баланс - Пассив')",
    "description": "Одно-два предложения о содержании документа и периоде",
    "headers": ["Колонка 1", "Колонка 2"],
    "rows": [["значение", "значение"]],
    "summary": {
      "totalRows": число,
      "keyMetrics": [
        {"label": "Название метрики", "value": "значение с единицей"}
      ]
    },
    "chartSuggestion": {
      "type": "bar | pie | none",
      "labelColumn": индекс_колонки_с_названиями,
      "valueColumn": индекс_колонки_со_значениями
    }
  }
  
  ═══════════════════════════════════════
  КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
  ═══════════════════════════════════════
  
  1. ТОЛЬКО JSON — никакого текста до или после, никаких markdown-обёрток.
  
  2. ИСПРАВЛЯЙ ОЧЕВИДНЫЕ OCR-ОШИБКИ:
      - "(" в одиночку, "{" в одиночку → значит "(0)" или "—" (пустое/нулевое значение)
      - "Детпоженные" → "Отложенные"
      - "ipg", "jpg" в названии — это расширение файла, игнорируй
      - Слипшиеся слова (типа "за 2021-2023 гг.Ключевые") разделяй точкой/пробелом
  
  3. ДЛЯ ФИНАНСОВЫХ ОТЧЁТОВ (баланс, П/У, ОДДС):
      - Сохраняй ВСЕ строки таблицы включая итоговые (Итого, Всего, Баланс)
      - Если есть несколько периодов (2021, 2022, 2023) — все они отдельные колонки
      - Числа в скобках "(123)" — это отрицательные значения, оставляй как "(123)" или "-123"
      - Пустые/нулевые ячейки → пустая строка "" или "—"
  
  4. ВЫБОР КОЛОНОК ДЛЯ chartSuggestion:
      - labelColumn = колонка с НАЗВАНИЯМИ (ФИО, Наименование показателя, Статья)
      - valueColumn = колонка с РЕАЛЬНЫМИ ДЕНЕЖНЫМИ СУММАМИ (последний период, "К выплате", "Сумма")
      - НИКОГДА не выбирай в качестве valueColumn:
        • Колонку "Код" (1310, 1320 — это коды строк, а не суммы)
        • Колонку "№" (порядковые номера)
        • Колонку "Дата"
      - Если в документе есть колонка "2023 г." или "Текущий год" — обычно это лучший valueColumn
      - type: "bar" — для сравнения статей; "pie" — для долей в общей сумме; "none" — если числовых данных нет
  
  5. keyMetrics — ВЫДЕЛИ 3-6 КЛЮЧЕВЫХ ЦИФР:
      - Для баланса: "Итого капитал и резервы", "Итого долгосрочные обязательства", "Итого краткосрочные обязательства", "БАЛАНС"
      - Для зарплаты: "ФОТ", "НДФЛ", "К выплате всего"
      - Для отчёта о прибылях: "Выручка", "Себестоимость", "Чистая прибыль"
      - Формат value: с разделителями тысяч ("2 274 974")
  
  6. Все значения в rows и headers — ТОЛЬКО СТРОКИ (даже числа).
  
  7. Если документ совсем не табличный — headers=["Параметр","Значение"], rows = ключевые факты.

  8. Анализируй текст только по правилам и законам РФ.
  
  ПРОВЕРЬ СЕБЯ ПЕРЕД ОТВЕТОМ:
  ✓ JSON валидный?
  ✓ headers и rows одинаковой длины?
  ✓ valueColumn указывает на колонку с РЕАЛЬНЫМИ СУММАМИ, а не на коды/номера?
  ✓ Исправил типичные OCR-ошибки?`;

// =============== OPENROUTER ===============
async function callOpenRouter(model, messages, retryCount = 0) {
  if (!OPENROUTER_KEY) {
    console.warn('[ai-extractor] OPENROUTER_API_KEY не задан');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'DocMind'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.0,
        max_tokens: 6000,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[ai-extractor] ${model} → ${res.status}:`, errText.substring(0, 250));
      if (res.status === 429 && retryCount < 1) {
        console.log(`[ai-extractor] Rate limit, ждём 3 сек...`);
        await new Promise(r => setTimeout(r, 3000));
        return await callOpenRouter(model, messages, retryCount + 1);
      }
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error(`[ai-extractor] ${model}: пустой ответ`);
      return null;
    }
    console.log(`[ai-extractor] ✅ ${model} ответила (${content.length} симв.)`);
    return content;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error(`[ai-extractor] ${model} timeout (3 мин)`);
    } else {
      console.error(`[ai-extractor] ${model} fetch error:`, err.message);
    }
    return null;
  }
}

// ============ openrouterTryModels ============
async function openrouterTryModels(messages) {
  for (const model of OR_TEXT_MODELS) {
    console.log(`[ai-extractor] Пробуем ${model}`);
    const result = await callOpenRouter(model, messages);
    if (result && typeof result === 'string' && result.trim().length > 0) {
      return result;
    }
  }
  return null;
}

// ============ openrouterFromText ============
async function openrouterFromText(text, fileName) {
  console.log(`[ai-extractor] Анализ текста для ${fileName}, ${text.length} симв.`);

  const isMulti = text.includes('=== Часть документа:');

  const userContent = isMulti
    ? `Имя файла: ${fileName}

⚠️ ВАЖНО: Это ОДИН документ, разбитый на НЕСКОЛЬКО ЧАСТЕЙ (например, страницы бухгалтерского баланса, отсканированные по отдельности, или несколько фото одной таблицы).

Каждая часть начинается с маркера "=== Часть документа: <имя_файла> ===".

ТВОЯ ЗАДАЧА:
1. ОБЪЕДИНИ данные из всех частей в ОДНУ единую таблицу.
2. Если в разных частях одинаковые заголовки колонок — это продолжение той же таблицы, просто добавь строки.
3. Если в одной части "Актив", а в другой "Пассив" бухбаланса — объедини их в одну таблицу или сделай две связанные.
4. НЕ ДУБЛИРУЙ заголовки таблицы — они должны быть один раз.
5. НЕ упоминай в title слова "часть 1", "часть 2", "страница 1".
6. Если строки повторяются в разных частях — оставь её ОДИН раз, взяв самые полные данные.
7. Если части содержат данные за РАЗНЫЕ периоды — добавь их как отдельные КОЛОНКИ.

ОБЪЕДИНЁННЫЙ ТЕКСТ ДОКУМЕНТА:
═══════════════════════════════════════
${text.substring(0, 15000)}
═══════════════════════════════════════

Извлеки ЕДИНУЮ таблицу из всех частей в формате JSON по правилам выше.`
    : `Имя файла: ${fileName}
(имя файла — это просто служебная информация, не включай его в title документа)

ТЕКСТ ДОКУМЕНТА (из OCR, могут быть ошибки распознавания):
═══════════════════════════════════════
${text.substring(0, 15000)}
═══════════════════════════════════════

Извлеки таблицу строго в формате JSON по правилам выше.`;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent }
  ];
  return await openrouterTryModels(messages);
}

// ============ safeParseJson ============
function safeParseJson(content) {
  if (!content) return null;
  let cleaned = String(content).trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) cleaned = cleaned.substring(first, last + 1);

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.headers) || !Array.isArray(parsed.rows)) {
      console.error('[ai-extractor] JSON без headers/rows');
      return null;
    }
    parsed.rows = parsed.rows.map(r => Array.isArray(r) ? r.map(v => v == null ? '' : String(v)) : []);
    parsed.headers = parsed.headers.map(h => h == null ? '' : String(h));
    return parsed;
  } catch (e) {
    console.error('[ai-extractor] JSON parse:', e.message);
    console.error('[ai-extractor] Контент был:', cleaned.substring(0, 500));
    return null;
  }
}

// ============ ocrImageIfNeeded ============
async function ocrImageIfNeeded(doc, filePath) {
  const name = doc.originalName || doc.fileName || '';
  const isImage = /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(name);

  if (!isImage) return null;
  if (doc.extractedText && doc.extractedText.trim().length > 20) return doc.extractedText;
  if (!filePath || !fs.existsSync(filePath)) return null;

  try {
    const ocrSvc = require('./ocr.service');
    const recognize = ocrSvc.recognizeImage || ocrSvc.extractTextFromImage;
    if (typeof recognize !== 'function') {
      console.warn('[ai-extractor] OCR-сервис не доступен');
      return null;
    }
    console.log(`[ai-extractor] 🔍 OCR картинки: ${name}`);
    const text = await recognize(filePath);
    if (text && text.trim().length > 5) {
      console.log(`[ai-extractor] OCR извлёк ${text.length} симв.`);
      return text;
    }
    return null;
  } catch (e) {
    console.error('[ai-extractor] OCR ошибка:', e.message);
    return null;
  }
}

// ============ manualParseTable ============
function manualParseTable(text, fileName) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return null;

  const splitLine = (line) => line.split(/\s{2,}|\t|\|/).map(c => c.trim()).filter(Boolean);

  let headerIdx = -1;
  let headerCells = [];

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cells = splitLine(lines[i]);
    if (cells.length >= 2) {
      headerIdx = i;
      headerCells = cells;
      break;
    }
  }

  if (headerIdx === -1 || headerCells.length < 2) {
    return {
      title: fileName,
      description: 'Текст извлечён через OCR',
      headers: ['Параметр', 'Значение'],
      rows: [
        ['Файл', fileName],
        ['Извлечённый текст', text.substring(0, 500)]
      ],
      summary: { totalRows: 2, keyMetrics: [] },
      chartSuggestion: { type: 'none', labelColumn: 0, valueColumn: 1 }
    };
  }

  const colCount = headerCells.length;
  const dataRows = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    if (cells.length >= Math.max(2, Math.floor(colCount * 0.5))) {
      while (cells.length < colCount) cells.push('');
      dataRows.push(cells.slice(0, colCount));
    }
  }

  if (dataRows.length === 0) return null;

  return {
    title: fileName,
    description: `Распознано ${dataRows.length} строк через OCR`,
    headers: headerCells,
    rows: dataRows,
    summary: { totalRows: dataRows.length, keyMetrics: [] },
    chartSuggestion: { type: 'bar', labelColumn: 0, valueColumn: 1 }
  };
}

// ============ extractStructured ============
async function extractStructured(doc, filePath) {
  const name = doc.originalName || doc.fileName || '';

  let text = doc.extractedText && doc.extractedText.trim();

  if (!text || text.length < 20) {
    const ocrText = await ocrImageIfNeeded(doc, filePath);
    if (ocrText) text = ocrText;
  }

  if (!text || text.length < 5) {
    console.warn('[ai-extractor] Нет текста для анализа');
    return null;
  }

  const raw = await openrouterFromText(text, name);
  const result = safeParseJson(raw);

  if (result && result.rows.length > 0) {
    console.log(`[ai-extractor] ✅ LLM: ${result.rows.length} строк × ${result.headers.length} колонок`);
    return result;
  }

  console.log('[ai-extractor] ⚠️ LLM не дала результат, fallback на ручной парсер');
  const manual = manualParseTable(text, name);
  if (manual) {
    console.log(`[ai-extractor] ✅ Ручной парсер: ${manual.rows.length} строк × ${manual.headers.length} колонок`);
    return manual;
  }

  console.log('[ai-extractor] ❌ Не удалось извлечь данные');
  return null;
}

module.exports = { extractStructured };