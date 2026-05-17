import { FILE_ICONS } from "./constants";

export function escapeHtml(text: string): string {
  if (!text) return "";
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML.replace(/\n/g, "<br>");
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getFileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return FILE_ICONS[ext] || "📎";
}

export function getFileExt(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

export function isImageFile(filename: string): boolean {
  const ext = getFileExt(filename);
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
}

export function stripEmojis(text: string): string {
  if (!text) return "";
  // Regex для всех Unicode эмодзи
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}])\u{FE0F}?/gu;
  return text
    .replace(emojiRegex, "")
    .replace(/  +/g, " ")           // двойные пробелы → одинарный
    .replace(/^\s+|\s+$/gm, "")     // trim каждой строки
    .replace(/\n{3,}/g, "\n\n");    // макс 2 переноса подряд
}

export function stripLeadingEmojis(text: string): string {
  if (!text) return "";
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}])\u{FE0F}?\s*/u;
  return text.split("\n").map(line => line.replace(emojiRegex, "")).join("\n");
}