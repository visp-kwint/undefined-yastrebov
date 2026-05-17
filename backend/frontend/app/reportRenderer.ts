import { stripEmojis } from "./utils";

export function isReportCommand(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes("отчёт") || lower.includes("отчет") ||
    lower.includes("диаграмма") || lower.includes("график") ||
    lower.includes("report") || lower.includes("chart") ||
    lower.includes("excel") || lower.includes("эксель") || lower.includes("pdf")
  );
}

function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTable(tableData: any): string {
  if (!tableData || !tableData.headers || !tableData.rows) return "";
  let html = '<div class="report-table-container">';
  if (tableData.title) html += '<h4 class="report-table-title">' + escapeHtml(tableData.title) + "</h4>";
  html += '<table class="report-table"><thead><tr>';
  tableData.headers.forEach((h: string) => { html += "<th>" + escapeHtml(String(h)) + "</th>"; });
  html += "</tr></thead><tbody>";
  tableData.rows.forEach((row: any[]) => {
    html += "<tr>";
    row.forEach((cell: any) => { html += "<td>" + escapeHtml(String(cell ?? "")) + "</td>"; });
    html += "</tr>";
  });
  if (tableData.totals && tableData.totals.length) {
    html += '<tr class="report-total">';
    tableData.totals.forEach((t: any) => { html += "<td><strong>" + escapeHtml(String(t ?? "")) + "</strong></td>"; });
    html += "</tr>";
  }
  html += "</tbody></table></div>";
  return html;
}

function renderImage(imageData: any): string {
  if (!imageData) return "";

  let src = "";
  const name = escapeHtml(imageData.name || imageData.title || "Диаграмма");

  if (imageData.dataUrl) {
    // Already a full data URL — use directly
    src = imageData.dataUrl;
  } else if (imageData.base64) {
    // Raw base64 — detect type or default to png
    const raw: string = imageData.base64;
    if (raw.startsWith("data:")) {
      src = raw;
    } else {
      // Determine mime from first bytes or default to png
      const mime = imageData.mime || "image/png";
      src = "data:" + mime + ";base64," + raw;
    }
  } else if (imageData.url) {
    src = imageData.url;
  } else {
    return "";
  }

  return (
    '<div class="report-image-container">' +
    '<div class="report-image-wrapper">' +
    '<img src="' + src + '" alt="' + name + '" class="report-image" loading="lazy" onerror="this.parentElement.parentElement.style.display=\'none\'">' +
    "</div>" +
    '<div class="report-image-caption">' + name + "</div>" +
    "</div>"
  );
}

function renderAttachments(files: any[]): string {
  if (!files || !files.length) return "";
  let html = '<div class="report-attachments"><h4 class="report-attachments-title">Файлы для скачивания</h4><div class="report-files">';
  files.forEach((file) => {
    // Иконка теперь через CSS-класс, без эмодзи в тексте
    const typeClass = file.type === "pdf" ? "file-pdf" : file.type === "excel" ? "file-excel" : file.type === "image" ? "file-image" : "file-generic";
    const url = escapeHtml(file.url || "");
    const fname = escapeHtml(stripEmojis(file.name || "Файл"));
    
    // SVG-иконки прямо в HTML
    let iconSvg = "";
    if (file.type === "pdf") {
      iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#ef4444" stroke-width="2"/><polyline points="14 2 14 8 20 8" stroke="#ef4444" stroke-width="2"/></svg>';
    } else if (file.type === "excel") {
      iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#22c55e" stroke-width="2"/><polyline points="14 2 14 8 20 8" stroke="#22c55e" stroke-width="2"/></svg>';
    } else if (file.type === "image") {
      iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    } else {
      iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
    }
    
    html += `<a href="${url}" download class="report-file-link">${iconSvg}<span>${fname}</span></a>`;
  });
  html += "</div></div>";
  return html;
}

function isChartLine(line: string): boolean {
  if (!line || line.length < 6) return false;
  if ((line.match(/[█▓▒░]/g) || []).length >= 2) return true;
  if (/\|?\s*[█▓▒░]{2,}\s*\|?/.test(line)) return true;
  if (/^\s*[\+\-]{3,}/.test(line)) return true;
  return false;
}

function formatTextBlock(text: string): string {
  if (!text) return "";

  // Protect code blocks
  const codeBlocks: string[] = [];
  let t = text.replace(/```([\s\S]*?)```/g, (_m, code) => {
    codeBlocks.push(escapeHtml(code.trim()));
    return `__CODE_${codeBlocks.length - 1}__`;
  });

  const lines = t.split("\n");
  let html = "";
  let chartBuf: string[] = [];

  const flushChart = () => {
    if (!chartBuf.length) return;
    html += '<div class="ascii-chart"><pre>' + escapeHtml(chartBuf.join("\n")) + "</pre></div>";
    chartBuf = [];
  };

  lines.forEach((line) => {
    if (isChartLine(line)) {
      chartBuf.push(line);
    } else {
      flushChart();
      // Apply markdown
      let l = escapeHtml(line);
      l = l.replace(/^### (.+)/, '<h4 class="report-subtitle">$1</h4>');
      l = l.replace(/^## (.+)/, '<h3 class="report-subtitle">$1</h3>');
      l = l.replace(/^# (.+)/, '<h2 class="report-subtitle">$1</h2>');
      l = l.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html += '<div class="report-text">' + l + "</div>";
    }
  });
  flushChart();

  // Restore code blocks
  codeBlocks.forEach((code, i) => {
    html = html.replace(`__CODE_${i}__`, `<pre class="report-code">${code}</pre>`);
  });

  return html;
}

export function renderReport(reportData: any): string {
  if (!reportData) return '<div class="report-card"><p class="report-text">Нет данных для отображения.</p></div>';

  let html = '<div class="report-card"><div class="report-header"><h3 class="report-title">Отчёт</h3></div><div class="report-body">';

  if (reportData.text) html += formatTextBlock(stripEmojis(reportData.text));
  if (Array.isArray(reportData.tables)) reportData.tables.forEach((t: any) => { html += renderTable(t); });

  const images: any[] = [];
  if (Array.isArray(reportData.images)) images.push(...reportData.images);
  if (Array.isArray(reportData.files)) {
    reportData.files.forEach((f: any) => { if (f.type === "image") images.push(f); });
  }
  images.forEach((img: any) => { html += renderImage(img); });

  const attachFiles: any[] = [];
  if (Array.isArray(reportData.attachments)) attachFiles.push(...reportData.attachments);
  if (Array.isArray(reportData.files)) {
    reportData.files.forEach((f: any) => { if (f.type !== "image") attachFiles.push(f); });
  }
  if (attachFiles.length) html += renderAttachments(attachFiles);

  html += "</div></div>";
  return html;
}