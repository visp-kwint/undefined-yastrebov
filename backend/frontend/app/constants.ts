export const MAX_FILES = 5;

export const TEMP_TEXTS = [
  "Обрабатываю...",
  "Думаю...",
  "Загружаю",
  "Генерирую отчёт...",
  "Анализирую...",
  "Строю диаграмму...",
];

export const COMMAND_LABELS: Record<string, string> = {
  analyze: "Анализ документа",
  summary: "Краткое содержание",
  report: "Генерация отчёта",
  chart: "Построение диаграммы",
  excel: "Экспорт в Excel",
  pdf: "Экспорт в PDF",
  compare: "Сравнение документов",
  extract: "Извлечение таблиц",
  salary: "Расчёт зарплаты",
  tax: "Налоговый расчёт",
  balance: "Баланс проводок",
  audit: "Аудит документа",
};

export const FILE_ICONS: Record<string, string> = {
  pdf: "",
  docx: "",
  doc: "",
  xlsx: "",
  xls: "",
  csv: "",
  jpg: "",
  jpeg: "",
  png: "",
  gif: "",
  txt: "",
};
