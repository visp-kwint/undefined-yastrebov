"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChatMessage, ChatSession, HistoryItem } from "./types";
import { MAX_FILES, TEMP_TEXTS, COMMAND_LABELS } from "./constants";
import { escapeHtml, formatSize, formatDate, stripEmojis } from "./utils";
import {
  apiRegister, apiLogin, apiGetMe, apiDeleteAccount,
  apiLoadSessions, apiCreateSession, apiSaveMessage,
  apiUpdateSessionTitle, apiDeleteSession,
  uploadFileToBackend, loadDocumentsFromBackend,
  apiAskQuestion, apiGenerateReport, apiRunCommand
} from "./api";
import { renderReport } from "./reportRenderer";
import {
  FolderIcon, BurgerIcon, NewChatIcon, ListIcon,
  SearchIcon, ReportsIcon, AttachIcon, CameraIcon,
  GalleryIcon, SendIcon, UserAvatarIcon, SignOutIcon, CopyIcon
} from "./components/Icons";
import {
  AnalyzeIcon, SummaryIcon, ReportIcon, ChartIcon,
  ExcelCmdIcon, PdfCmdIcon, CompareIcon, ExtractIcon,
  SalaryIcon, TaxIcon, BalanceIcon, AuditIcon,
  UploadIcon, ChatIcon, BarChartIcon, CalculatorIcon,
  SparkleIcon, StarIcon, getFileIconComponent
} from "./components/AppIcons";

// ── Chevron ─────────────────────────────────────────────────────────────
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: "transform 0.25s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ── Format AI text ──────────────────────────────────────────────────────
// ── Helpers для распознавания специальных блоков ─────────────────────────

function escapeHtmlStr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Распознаёт markdown-таблицу: | a | b | \n |---|---| \n | 1 | 2 |
function parseMarkdownTable(lines: string[], startIdx: number): { html: string; consumed: number } | null {
  if (startIdx >= lines.length) return null;
  const first = lines[startIdx].trim();
  if (!first.startsWith("|") || !first.endsWith("|")) return null;

  const headers = first.slice(1, -1).split("|").map(c => c.trim());
  if (headers.length < 2) return null;

  if (startIdx + 1 >= lines.length) return null;
  const sep = lines[startIdx + 1].trim();
  // Разделитель: |---|---|---| или | --- | --- |
  if (!/^\|[\s\-:|]+\|$/.test(sep)) return null;
  // Проверка что в разделителе есть хотя бы 2 группы дефисов
  const sepParts = sep.slice(1, -1).split("|");
  if (sepParts.length !== headers.length) return null;
  if (!sepParts.every(p => /^[\s\-:]+$/.test(p) && p.includes("-"))) return null;

  const rows: string[][] = [];
  let i = startIdx + 2;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line.startsWith("|") || !line.endsWith("|")) break;
    const cells = line.slice(1, -1).split("|").map(c => c.trim());
    if (cells.length !== headers.length) break;
    rows.push(cells);
    i++;
  }
  if (rows.length === 0) return null;

  let html = '<div class="ai-table-wrapper"><table class="ai-table"><thead><tr>';
  headers.forEach(h => { html += `<th>${escapeHtmlStr(h)}</th>`; });
  html += "</tr></thead><tbody>";
  rows.forEach(row => {
    html += "<tr>";
    row.forEach((cell, idx) => {
      const isNumber = /^[\d\s.,]+$/.test(cell) && cell.length > 0 && idx > 0;
      html += `<td${isNumber ? ' class="num"' : ''}>${escapeHtmlStr(cell)}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table></div>";

  return { html, consumed: i - startIdx };
}

// Распознаёт строки вида:
// "Иванов И.И. | ████████ 80000"
// "[80 000] | Иванов И.И."  
// "Иванов И.И. ████████ 80 000"
// "Всего расходов: [427 928] руб."
type BarLine = { label: string; value: number; rawValue: string; unit: string };

function parseBarLine(line: string): BarLine | null {
  const cleaned = line.replace(/[█▓▒░|]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  // Паттерн 1: "Метка [число] единица"  или "Метка: [число]"
  let m = cleaned.match(/^(.+?)\s*[:|]?\s*\[([\d\s,.]+)\]\s*(.*)$/);
  if (m) {
    const [, label, val, unit] = m;
    const num = parseFloat(val.replace(/[\s,]/g, ""));
    if (!isNaN(num)) {
      return { label: label.trim(), value: num, rawValue: val.trim(), unit: unit.trim() };
    }
  }

  // Паттерн 2: "Метка 80 000" или "Метка: 80000"
  m = cleaned.match(/^(.+?)\s*[:|]?\s+(\d[\d\s.,]*)\s*(руб\.?|%|шт\.?)?\s*$/i);
  if (m) {
    const [, label, val, unit] = m;
    const num = parseFloat(val.replace(/[\s,]/g, ""));
    if (!isNaN(num) && num > 0 && label.length > 1) {
      return { label: label.trim(), value: num, rawValue: val.trim(), unit: (unit || "").trim() };
    }
  }

  return null;
}

// Распознаём блок ASCII-диаграммы (есть символы █ или несколько одинаковых строк-баров)
function isLikelyBarLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Содержит блочные символы
  if (/[█▓▒░]{2,}/.test(trimmed)) return true;
  return false;
}

// ── ГЛАВНАЯ функция: обрабатывает AI-текст ───────────────────────────────
function processAiText(text: string): string {
  if (!text) return "";

  // 1. Чистим эмодзи и нормализуем
  let t = stripEmojis(text);
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/\r\n/g, "\n");

  // 2. ВАЖНО: Разбиваем склеенные заголовки и разделители
  // Если "===ТЕКСТ===Что-то ещё" — добавляем перенос
  t = t.replace(/(===\s*[^=]+?\s*===)(?=\S)/g, "$1\n");
  // Если "что-то===ЗАГОЛОВОК" — добавляем перенос
  t = t.replace(/(\S)(===\s*[А-ЯA-Z])/g, "$1\n$2");
  // Длинные дефисы-разделители прилипшие к тексту: "руб.---" → "руб.\n---"
  t = t.replace(/([а-яa-zё.])(-{5,})/gi, "$1\n$2");
  t = t.replace(/(-{5,})(\S)/g, "$1\n$2");
  // Прилипшие markdown-таблицы
  t = t.replace(/(\S)(\|\s*-{2,})/g, "$1\n$2");

  const lines = t.split("\n");
  const result: string[] = [];

  // Собираем строки баров в группы
  let barBuffer: BarLine[] = [];
  let lastWasBar = false;

  const flushBars = () => {
    if (barBuffer.length === 0) return;

    // Если в группе только 1 строка — не делаем диаграмму, рендерим как обычно
    if (barBuffer.length === 1) {
      const b = barBuffer[0];
      let line = `${escapeHtmlStr(b.label)}: <span class="ai-num-badge">${escapeHtmlStr(b.rawValue)}</span>`;
      if (b.unit) line += " " + escapeHtmlStr(b.unit);
      result.push(line + "<br>");
      barBuffer = [];
      return;
    }

    // Полноценная диаграмма
    const max = Math.max(...barBuffer.map(b => b.value));
    let chart = '<div class="ai-bar-chart">';
    barBuffer.forEach(b => {
      const percent = max > 0 ? (b.value / max) * 100 : 0;
      chart += `<div class="ai-bar-row">
        <div class="ai-bar-label" title="${escapeHtmlStr(b.label)}">${escapeHtmlStr(b.label)}</div>
        <div class="ai-bar-track"><div class="ai-bar-fill" style="width:${percent.toFixed(1)}%"></div></div>
        <div class="ai-bar-value">${escapeHtmlStr(b.rawValue)}${b.unit ? " " + escapeHtmlStr(b.unit) : ""}</div>
      </div>`;
    });
    chart += "</div>";
    result.push(chart);
    barBuffer = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Markdown-таблица
    const tableResult = parseMarkdownTable(lines, i);
    if (tableResult) {
      flushBars();
      result.push(tableResult.html);
      i += tableResult.consumed;
      lastWasBar = false;
      continue;
    }

    // 2. Пустая строка
    if (!trimmed) {
      flushBars();
      lastWasBar = false;
      // Не добавляем лишние <br> после блочных
      const last = result[result.length - 1];
      if (last && !/<br>\s*$/.test(last) && !/<\/(div|table|hr|span)>\s*$/.test(last)) {
        result.push("<br>");
      }
      i++;
      continue;
    }

    // 3. Разделитель ---- или ====
    if (/^[-=_]{4,}$/.test(trimmed)) {
      flushBars();
      result.push("<hr>");
      i++;
      lastWasBar = false;
      continue;
    }

    // 4. === SECTION HEADER ===
    const headerMatch = trimmed.match(/^===\s*(.+?)\s*===\s*$/);
    if (headerMatch) {
      flushBars();
      result.push(`<div class="ai-section-header">${escapeHtmlStr(headerMatch[1])}</div>`);
      i++;
      lastWasBar = false;
      continue;
    }

    // 5. ЗАГОЛОВОК ПРОПИСНЫМИ
    if (trimmed.length > 3 && trimmed.length < 80 &&
        trimmed === trimmed.toUpperCase() &&
        /[А-ЯЁ]/.test(trimmed) &&
        !/[.!?:]/.test(trimmed) &&
        !/\d/.test(trimmed.substring(0, 5))) {
      flushBars();
      result.push(`<div class="ai-section-header">${escapeHtmlStr(trimmed)}</div>`);
      i++;
      lastWasBar = false;
      continue;
    }

    // 6. Возможно бар-чарт строка?
    // Условие: содержит блочные символы ИЛИ это группа подряд идущих "метка число"
    const hasBarSymbols = isLikelyBarLine(trimmed);
    const parsed = parseBarLine(trimmed);

    if (hasBarSymbols && parsed) {
      // Точно бар
      barBuffer.push(parsed);
      lastWasBar = true;
      i++;
      continue;
    }

    // Если предыдущая была баром и текущая тоже распознаётся как "метка число"
    if (lastWasBar && parsed && parsed.value > 0) {
      barBuffer.push(parsed);
      i++;
      continue;
    }

    // Не бар — сбрасываем буфер
    flushBars();
    lastWasBar = false;

    // 7. Обычная строка
    let processed = escapeHtmlStr(line);

    // **bold**
    processed = processed.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // [числа] → бейдж
    processed = processed.replace(/\[([\d][\d\s.,]*)\]/g, '<span class="ai-num-badge">$1</span>');

    // Маркеры списков: "• ", "- ", "* ", "▪ "
    const bulletMatch = trimmed.match(/^[•▪▫◦‣⁃\-\*]\s+(.+)$/);
    if (bulletMatch) {
      let content = escapeHtmlStr(bulletMatch[1]);
      content = content.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      content = content.replace(/\[([\d][\d\s.,]*)\]/g, '<span class="ai-num-badge">$1</span>');
      result.push(`<div class="ai-bullet">${content}</div>`);
      i++;
      continue;
    }

    result.push(processed + "<br>");
    i++;
  }

  flushBars();

  let html = result.join("");

  // Финальная зачистка: убираем <br> рядом с блочными элементами
  html = html.replace(/<br>\s*(<(?:hr|div|table))/g, "$1");
  html = html.replace(/(<\/(?:hr|div|table)>)\s*<br>/g, "$1");
  html = html.replace(/(<br>\s*){3,}/g, "<br><br>");
  // Удаляем <br> в самом начале и конце
  html = html.replace(/^(<br>\s*)+/, "").replace(/(<br>\s*)+$/, "");

  return html;
}

// ── Command palette items ───────────────────────────────────────────────
type PaletteItem = {
  id: string;
  title: string;
  desc: string;
  section: string;
  icon: React.ReactNode;
  action: () => void;
};

const PINNED_KEY = "docmind_pinned_sessions";

export default function Home() {
  // ── State ───────────────────────────────────────────────────────────────
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [lastDocumentIds, setLastDocumentIds] = useState<string[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: string; show: boolean }>({ msg: "", type: "default", show: false });
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"register" | "login">("register");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<"welcome" | "chat" | "documents" | "reports">("welcome");
  const [documents, setDocuments] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");
  const [regMessage, setRegMessage] = useState<{ text: string; type: string }>({ text: "", type: "" });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState<{ text: string; type: string }>({ text: "", type: "" });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const [cmdPanelOpen, setCmdPanelOpen] = useState(true);
  const [acctPanelOpen, setAcctPanelOpen] = useState(false);

  // 🔥 NEW: Drag & Drop
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // 🔥 NEW: Command Palette
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteActiveIdx, setPaletteActiveIdx] = useState(0);

  // 🔥 NEW: Pinned sessions
  const [pinnedSessionIds, setPinnedSessionIds] = useState<string[]>([]);

  // ── Refs ────────────────────────────────────────────────────────────────
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);

  const chatSessionsRef = useRef(chatSessions);
  chatSessionsRef.current = chatSessions;
  const currentSessionIdRef = useRef(currentSessionId);
  currentSessionIdRef.current = currentSessionId;
  const authTokenRef = useRef(authToken);
  authTokenRef.current = authToken;

  // ── Load pinned from localStorage ──────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PINNED_KEY);
      if (stored) setPinnedSessionIds(JSON.parse(stored));
    } catch {}
  }, []);

  const togglePinSession = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedSessionIds((prev) => {
      const next = prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId];
      try { localStorage.setItem(PINNED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, type = "default", duration = 3000) => {
    setToast({ msg, type, show: true });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), duration);
  }, []);

  const setLoggedIn = useCallback((user: any, token: string) => {
    setAuthToken(token);
    authTokenRef.current = token;
    setCurrentUser(user);
    localStorage.setItem("docmind_token", token);
    document.body.classList.add("logged-in");
    showToast("Добро пожаловать, " + user.email + "!", "success");
  }, [showToast]);

  const setLoggedOut = useCallback(() => {
    setAuthToken(null);
    authTokenRef.current = null;
    setCurrentUser(null);
    localStorage.removeItem("docmind_token");
    document.body.classList.remove("logged-in");
  }, []);

  const getCurrentSession = useCallback(
    (): ChatSession | undefined => chatSessionsRef.current.find((s) => s.id === currentSessionIdRef.current),
    []
  );

  const createNewSession = useCallback(async (firstMessage: string): Promise<ChatSession> => {
    const title = firstMessage.substring(0, 40) + (firstMessage.length > 40 ? "..." : "");
    const session: ChatSession = {
      id: "local_" + Date.now(),
      dbId: null,
      title,
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date(),
    };
    const token = authTokenRef.current;
    if (token) {
      const dbSession = await apiCreateSession(token, title);
      if (dbSession) { session.id = dbSession.id; session.dbId = dbSession.id; }
    }
    const next = [...chatSessionsRef.current, session];
    setChatSessions(next);
    chatSessionsRef.current = next;
    setCurrentSessionId(session.id);
    currentSessionIdRef.current = session.id;
    return session;
  }, []);

  const removeTempMessage = useCallback(() => {
    setChatMessages((prev) => prev.filter((m) => !TEMP_TEXTS.some((t) => m.text && m.text.startsWith(t))));
  }, []);

  const addMessageToSession = useCallback(
    async (sender: "user" | "ai", text: string, isHtml = false, attachments?: { name: string; size: number }[]) => {
      if (sender === "ai" && !TEMP_TEXTS.some((t) => text.startsWith(t))) {
        setChatMessages((prev) => prev.filter((m) => !TEMP_TEXTS.some((t) => m.text && m.text.startsWith(t))));
      }

      let session = getCurrentSession();
      if (!session) session = await createNewSession(text);

      const message: ChatMessage = {
        id: Date.now() + Math.random() + "",
        sender, text, isHtml,
        time: new Date(), attachments,
      };
      session.messages.push(message);
      session.lastActivity = new Date();

      const userMsgs = session.messages.filter((m) => m.sender === "user");
      if (userMsgs.length === 1 && sender === "user") {
        session.title = text.substring(0, 40) + (text.length > 40 ? "..." : "");
        if (session.dbId && authTokenRef.current)
          apiUpdateSessionTitle(authTokenRef.current, session.dbId, session.title);
      }

      const isTemp = TEMP_TEXTS.some((t) => text && text.startsWith(t));
      if (session.dbId && authTokenRef.current && !isTemp) {
        await apiSaveMessage(authTokenRef.current, session.dbId, sender, text, isHtml);
      }

      const next = chatSessionsRef.current.map((s) =>
        s.id === session!.id ? { ...session!, messages: [...session!.messages] } : s
      );
      setChatSessions(next);
      chatSessionsRef.current = next;
      setChatMessages((prev) => [...prev, message]);
      return message;
    },
    [getCurrentSession, createNewSession]
  );

  const loadSessionsFromDB = useCallback(async (token: string) => {
    try {
      const sessions = await apiLoadSessions(token);
      if (!sessions.length) return;
      const mapped: ChatSession[] = sessions.map((s: any) => ({
        id: s.id, dbId: s.id, title: s.title || "Без названия",
        messages: (s.messages || [])
          .filter((m: any) => !TEMP_TEXTS.some((t) => m.text && m.text.startsWith(t)))
          .map((m: any) => ({
            id: m.id || Date.now() + Math.random() + "",
            sender: m.sender === "user" || m.sender === "ai" ? m.sender : "ai",
            text: m.text || "", isHtml: !!m.isHtml,
            time: m.createdAt ? new Date(m.createdAt) : new Date(),
          })),
        createdAt: new Date(s.createdAt || Date.now()),
        lastActivity: new Date(s.updatedAt || s.createdAt || Date.now()),
      }));
      setChatSessions(mapped);
      chatSessionsRef.current = mapped;
    } catch (error) { console.error("[Session Restore] Error:", error); }
  }, []);

  const restoreSession = useCallback(async () => {
    setIsRestoring(true);
    try {
      const token = localStorage.getItem("docmind_token");
      if (!token) { setIsRestoring(false); return; }
      const user = await apiGetMe(token);
      if (user) {
        setCurrentUser(user);
        setAuthToken(token);
        authTokenRef.current = token;
        document.body.classList.add("logged-in");
        await loadSessionsFromDB(token);
      } else setLoggedOut();
    } catch { setLoggedOut(); }
    finally { setIsRestoring(false); }
  }, [loadSessionsFromDB, setLoggedOut]);

  useEffect(() => {
    restoreSession();
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [restoreSession]);

  useEffect(() => { if (chatInputRef.current) chatInputRef.current.focus(); }, [view]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

    // Keyboard shortcuts
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        // Cmd+K / Ctrl+K → open palette
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          setPaletteOpen((v) => !v);
          return;
        }
        if (e.key === "Escape") {
          setLoginModalOpen(false);
          setProfileModalOpen(false);
          setDeleteModalOpen(false);
          setSidebarOpen(false);
          setPaletteOpen(false);
        }
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, []);
  
    useEffect(() => {
      if (paletteOpen && paletteInputRef.current) {
        paletteInputRef.current.focus();
        setPaletteQuery("");
        setPaletteActiveIdx(0);
      }
    }, [paletteOpen]);
  
    useEffect(() => {
      if (attachedFiles.length === 0) {
        if (fileUploadRef.current) fileUploadRef.current.value = "";
        if (cameraRef.current) cameraRef.current.value = "";
        if (galleryRef.current) galleryRef.current.value = "";
      }
    }, [attachedFiles]);
  
    async function checkHealth() {
      try { await fetch("/api/health"); setBackendOnline(true); }
      catch { setBackendOnline(false); }
    }
  
    // ── File handling ───────────────────────────────────────────────────────
    const addFilesToList = useCallback((files: FileList | File[] | null) => {
      if (!files || !files.length) return;
      const arr = Array.from(files);
      setAttachedFiles((prev) => {
        const next = [...prev];
        for (const file of arr) {
          if (next.length >= MAX_FILES) { showToast("Максимум " + MAX_FILES + " файлов", "error"); break; }
          const isDup = next.some((f) => f.name === file.name && f.size === file.size);
          if (!isDup) next.push(file);
        }
        return next;
      });
    }, [showToast]);
  
    const clearAttachedFiles = useCallback(() => {
      setAttachedFiles([]);
      if (fileUploadRef.current) fileUploadRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }, []);
  
    const removeAttachedFile = useCallback((index: number) => {
      setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    }, []);
  
    // ── 🔥 DRAG & DROP ──────────────────────────────────────────────────────
    useEffect(() => {
      const handleDragEnter = (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")) {
          dragCounter.current++;
          setIsDragging(true);
        }
      };
      const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        dragCounter.current--;
        if (dragCounter.current <= 0) {
          dragCounter.current = 0;
          setIsDragging(false);
        }
      };
      const handleDragOver = (e: DragEvent) => { e.preventDefault(); };
      const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        dragCounter.current = 0;
        setIsDragging(false);
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          const allowedExts = ["pdf", "docx", "doc", "xlsx", "xls", "csv", "txt", "jpg", "jpeg", "png", "gif"];
          const validFiles = Array.from(e.dataTransfer.files).filter(f => {
            const ext = f.name.split(".").pop()?.toLowerCase() || "";
            return allowedExts.includes(ext);
          });
          if (validFiles.length === 0) {
            showToast("Неподдерживаемый формат файла", "error");
            return;
          }
          if (validFiles.length < e.dataTransfer.files.length) {
            showToast(`Добавлено ${validFiles.length} из ${e.dataTransfer.files.length} файлов`, "default");
          } else {
            showToast(`Добавлено ${validFiles.length} ${validFiles.length === 1 ? "файл" : "файла"}`, "success");
          }
          addFilesToList(validFiles);
        }
      };
      window.addEventListener("dragenter", handleDragEnter);
      window.addEventListener("dragleave", handleDragLeave);
      window.addEventListener("dragover", handleDragOver);
      window.addEventListener("drop", handleDrop);
      return () => {
        window.removeEventListener("dragenter", handleDragEnter);
        window.removeEventListener("dragleave", handleDragLeave);
        window.removeEventListener("dragover", handleDragOver);
        window.removeEventListener("drop", handleDrop);
      };
    }, [addFilesToList, showToast]);
  
    // ── AI responders ───────────────────────────────────────────────────────
    const askYandex = useCallback(async (question: string, docIds: string[]) => {
      await addMessageToSession("ai", "Думаю...");
      try {
        const result = await apiAskQuestion(question, docIds);
        removeTempMessage();
        if (result.success) await addMessageToSession("ai", processAiText(result.answer), true);
        else await addMessageToSession("ai", "Ошибка: " + result.error);
      } catch { removeTempMessage(); await addMessageToSession("ai", "Ошибка сети: сервер не отвечает."); }
    }, [addMessageToSession, removeTempMessage]);
  
    const askReport = useCallback(async (docIds: string[]) => {
      await addMessageToSession("ai", "Генерирую отчёт...");
      try {
        const documentId = docIds.length ? docIds[docIds.length - 1] : null;
        if (!documentId) { removeTempMessage(); await addMessageToSession("ai", "Нет загруженных документов."); return; }
        const reportData = await apiGenerateReport(documentId, "all");
        removeTempMessage();
        if (reportData.success) await addMessageToSession("ai", renderReport(reportData.data), true);
        else await addMessageToSession("ai", "Ошибка: " + (reportData.error || "Не удалось сгенерировать отчёт."));
      } catch { removeTempMessage(); await addMessageToSession("ai", "Ошибка при генерации отчёта."); }
    }, [addMessageToSession, removeTempMessage]);
  
    const askChart = useCallback(async (docIds: string[]) => {
      await addMessageToSession("ai", "Строю диаграмму...");
      try {
        const documentId = docIds.length ? docIds[docIds.length - 1] : null;
        if (!documentId) { removeTempMessage(); await addMessageToSession("ai", "Нет загруженных документов."); return; }
        const reportData = await apiGenerateReport(documentId, "charts");
        removeTempMessage();
        if (reportData.success) await addMessageToSession("ai", renderReport(reportData.data), true);
        else await addMessageToSession("ai", "Ошибка: " + (reportData.error || "Не удалось построить диаграмму."));
      } catch { removeTempMessage(); await addMessageToSession("ai", "Ошибка."); }
    }, [addMessageToSession, removeTempMessage]);
  
    const askSummary = useCallback(async (docIds: string[]) => {
      await addMessageToSession("ai", "Анализирую...");
      try {
        const documentId = docIds.length ? docIds[docIds.length - 1] : null;
        if (!documentId) { removeTempMessage(); await addMessageToSession("ai", "Нет загруженных документов."); return; }
        const result = await apiAskQuestion("Сделай краткое содержание и выдели ключевые цифры, таблицы, даты", [documentId]);
        removeTempMessage();
        if (result.success) await addMessageToSession("ai", processAiText(result.answer), true);
        else await addMessageToSession("ai", "Ошибка: " + result.error);
      } catch { removeTempMessage(); await addMessageToSession("ai", "Ошибка."); }
    }, [addMessageToSession, removeTempMessage]);
  
    const askExport = useCallback(async (docIds: string[], type: string) => {
      await addMessageToSession("ai", "Генерирую файл...");
      try {
        const documentId = docIds.length ? docIds[docIds.length - 1] : null;
        if (!documentId) { removeTempMessage(); await addMessageToSession("ai", "Нет загруженных документов."); return; }
        const reportData = await apiGenerateReport(documentId, type);
        removeTempMessage();
        if (reportData.success) await addMessageToSession("ai", renderReport(reportData.data), true);
        else await addMessageToSession("ai", "Ошибка: " + (reportData.error || "Не удалось создать файл."));
      } catch { removeTempMessage(); await addMessageToSession("ai", "Ошибка."); }
    }, [addMessageToSession, removeTempMessage]);
  
    const routeAiRequest = useCallback(async (text: string, docIds: string[]) => {
      const lower = text.toLowerCase();
      if (lower.includes("отчёт") || lower.includes("отчет") || lower.includes("report")) await askReport(docIds);
      else if (lower.includes("диаграмма") || lower.includes("график") || lower.includes("chart")) await askChart(docIds);
      else if (lower.includes("сводка") || lower.includes("summary") || lower.includes("анализ")) await askSummary(docIds);
      else if (lower.includes("excel") || lower.includes("эксель")) await askExport(docIds, "excel");
      else if (lower.includes("pdf")) await askExport(docIds, "pdf");
      else await askYandex(text, docIds);
    }, [askReport, askChart, askSummary, askExport, askYandex]);
  
    const executeCommand = useCallback(async (command: string, params: any = {}) => {
      const documentId = lastDocumentIds.length ? lastDocumentIds[lastDocumentIds.length - 1] : null;
      const needsDoc = !["compare"].includes(command) || lastDocumentIds.length >= 1;
      if (!documentId && needsDoc) { showToast("Сначала загрузите документ", "error"); return; }
  
      setView("chat");
      await addMessageToSession("user", COMMAND_LABELS[command] || command);
  
      if (["report", "chart", "excel", "pdf"].includes(command)) {
        const typeMap: Record<string, string> = { report: "all", chart: "charts", excel: "excel", pdf: "pdf" };
        await addMessageToSession("ai", "Генерирую отчёт...");
        const reportData = await apiGenerateReport(documentId!, typeMap[command]);
        removeTempMessage();
        if (reportData.success) await addMessageToSession("ai", renderReport(reportData.data), true);
        else await addMessageToSession("ai", "Ошибка: " + (reportData.error || "Не удалось сгенерировать."));
        return;
      }
  
      if (command === "compare") {
        if (lastDocumentIds.length < 2) {
          await addMessageToSession("ai", "Для сравнения нужно загрузить минимум 2 документа. Загрузите ещё один и повторите.");
          return;
        }
        await addMessageToSession("ai", "Сравниваю документы...");
        const result = await apiAskQuestion(
          "Сравни эти документы: выдели сходства, ключевые различия, покажи отличия в показателях и сделай вывод.",
          lastDocumentIds.slice(-2)
        );
        removeTempMessage();
        if (result.success) await addMessageToSession("ai", processAiText(result.answer), true);
        else await addMessageToSession("ai", "Ошибка: " + result.error);
        return;
      }
  
      await addMessageToSession("ai", "Выполняю команду...");
      const result = await apiRunCommand(command, documentId!, params);
      removeTempMessage();
      if (result.success) {
        const data = result.data;
        if (data?.html) await addMessageToSession("ai", data.html, true);
        else if (data?.text) await addMessageToSession("ai", processAiText(data.text), true);
        else await addMessageToSession("ai", "Команда выполнена, но данные не получены.");
      } else await addMessageToSession("ai", "Ошибка: " + (result.error || "Ошибка выполнения команды"));
    }, [lastDocumentIds, showToast, addMessageToSession, removeTempMessage]);
  
    const sendMessage = useCallback(async () => {
      const files = [...attachedFiles];
      const text = inputText.trim();
      const hasFiles = files.length > 0;
      if (!text && !hasFiles) return;
  
      setView("chat");
      setInputText("");
      if (chatInputRef.current) { chatInputRef.current.value = ""; chatInputRef.current.style.height = "auto"; }
      setAttachedFiles([]);
      if (fileUploadRef.current) fileUploadRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
  
      if (hasFiles) {
        const fileMeta = files.map((f) => ({ name: f.name, size: f.size }));
        await addMessageToSession("user", text, false, fileMeta);
        await addMessageToSession("ai", "Обрабатываю...");
        const newIds: string[] = [];
        for (const file of files) {
          const result = await uploadFileToBackend(authTokenRef.current, file);
          if (result.success && result.data.id) newIds.push(result.data.id);
        }
        removeTempMessage();
        if (!newIds.length) { await addMessageToSession("ai", "Не удалось загрузить файлы. Проверьте формат."); return; }
        const updatedDocIds = [...new Set([...lastDocumentIds, ...newIds])];
        setLastDocumentIds(updatedDocIds);
        if (text) await routeAiRequest(text, updatedDocIds);
        else await addMessageToSession("ai",
          (files.length > 1 ? `${files.length} файла загружено` : `«${files[0].name}» загружен`) +
          "\nЗадайте вопрос или выберите команду слева!"
        );
      } else {
        await addMessageToSession("user", text);
        await routeAiRequest(text, lastDocumentIds);
      }
    }, [attachedFiles, inputText, lastDocumentIds, addMessageToSession, removeTempMessage, routeAiRequest]);
  
    const autoUploadFromCamera = useCallback(async (file: File) => {
      setAttachedFiles((prev) => prev.filter((f) => !(f.name === file.name && f.size === file.size)));
      setView("chat");
      const fileMeta = [{ name: file.name, size: file.size }];
      await addMessageToSession("user", "", false, fileMeta);
      await addMessageToSession("ai", "Загружаю...");
      const result = await uploadFileToBackend(authTokenRef.current, file);
      removeTempMessage();
      if (result.success) {
        const d = result.data;
        if (d.id) setLastDocumentIds((prev) => [...new Set([...prev, d.id])]);
        await addMessageToSession("ai",
          `«${file.name}» загружен!\n` +
          (d.extractedText ? "Задайте вопрос или выберите команду слева!" : "Текст не удалось извлечь.")
        );
      } else await addMessageToSession("ai", "Ошибка: " + (result.data?.error || result.error || "неизвестная"));
    }, [addMessageToSession, removeTempMessage]);
  
    // ── Session navigation ──────────────────────────────────────────────────
    const loadSession = useCallback((sessionId: string) => {
      const session = chatSessionsRef.current.find((s) => s.id === sessionId);
      if (!session) return;
      setCurrentSessionId(sessionId);
      currentSessionIdRef.current = sessionId;
      setLastDocumentIds([]);
      clearAttachedFiles();
      setView("chat");
      setChatMessages(session.messages.map((m) => ({ ...m, time: m.time instanceof Date ? m.time : new Date(m.time) })));
      if (chatInputRef.current) chatInputRef.current.focus();
      if (window.innerWidth <= 768) setSidebarOpen(false);
    }, [clearAttachedFiles]);
  
    const handleNavNewDoc = useCallback(() => {
      setCurrentSessionId(null); currentSessionIdRef.current = null;
      setLastDocumentIds([]); clearAttachedFiles(); setChatMessages([]); setView("welcome");
      if (chatInputRef.current) chatInputRef.current.focus();
      if (window.innerWidth <= 768) setSidebarOpen(false);
    }, [clearAttachedFiles]);
  
    const handleNavList = useCallback(async () => {
      setView("documents");
      if (window.innerWidth <= 768) setSidebarOpen(false);
      const docs = await loadDocumentsFromBackend(authTokenRef.current);
      setDocuments(docs);
    }, []);
  
    const handleNavSearch = useCallback(() => {
      const query = prompt("Поисковый запрос:");
      if (!query) return;
      setView("chat"); setCurrentSessionId(null); currentSessionIdRef.current = null; setChatMessages([]);
      addMessageToSession("user", "Поиск: " + query);
      fetch("/api/documents/search?q=" + encodeURIComponent(query), {
        headers: authTokenRef.current ? { Authorization: "Bearer " + authTokenRef.current } : {}
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          const results = Array.isArray(data) ? data : data.results || [];
          if (results.length) {
            let txt = "Найдено: " + results.length + "\n\n";
            results.forEach((r: any, i: number) => { txt += `${i + 1}. ${r.originalName || r.name}\n`; });
            addMessageToSession("ai", txt);
          } else addMessageToSession("ai", `Ничего не найдено по запросу «${query}»`);
        })
        .catch(() => addMessageToSession("ai", "Поиск пока не реализован на сервере."));
    }, [addMessageToSession]);
  
    const handleNavReports = useCallback(async () => {
      setView("reports");
      if (window.innerWidth <= 768) setSidebarOpen(false);
      try {
        const res = await fetch("/api/reports", {
          headers: authTokenRef.current ? { Authorization: "Bearer " + authTokenRef.current } : {}
        });
        const data = await res.json();
        setReports(data.reports || []);
      } catch { setReports([]); }
    }, []);
  
    // ── Auth ────────────────────────────────────────────────────────────────
    const handleRegister = useCallback(async () => {
      setRegMessage({ text: "", type: "" });
      if (!regEmail || !regPassword || !regPassword2) { setRegMessage({ text: "Заполните все поля", type: "error" }); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) { setRegMessage({ text: "Введите корректный email", type: "error" }); return; }
      if (regPassword.length < 4) { setRegMessage({ text: "Пароль минимум 4 символа", type: "error" }); return; }
      if (regPassword !== regPassword2) { setRegMessage({ text: "Пароли не совпадают", type: "error" }); return; }
      setRegisterLoading(true);
      const result = await apiRegister(regEmail, regPassword);
      setRegisterLoading(false);
      if (result.ok) {
        setRegMessage({ text: "Аккаунт создан!", type: "success" });
        setLoggedIn(result.data.user, result.data.token);
        await loadSessionsFromDB(result.data.token);
        setTimeout(() => {
          setLoginModalOpen(false);
          setRegEmail(""); setRegPassword(""); setRegPassword2(""); setRegMessage({ text: "", type: "" });
        }, 800);
      } else {
        setRegMessage({
          text: (result.data.error || "Ошибка регистрации") + (result.status === 409 ? " — войдите во вкладке «Вход»" : ""),
          type: "error"
        });
      }
    }, [regEmail, regPassword, regPassword2, setLoggedIn, loadSessionsFromDB]);
  
    const handleLogin = useCallback(async () => {
      setLoginMessage({ text: "", type: "" });
      if (!loginEmail || !loginPassword) { setLoginMessage({ text: "Введите email и пароль", type: "error" }); return; }
      setLoginLoading(true);
      const result = await apiLogin(loginEmail, loginPassword);
      setLoginLoading(false);
      if (result.ok) {
        setLoginMessage({ text: "Вход выполнен!", type: "success" });
        setLoggedIn(result.data.user, result.data.token);
        await loadSessionsFromDB(result.data.token);
        setTimeout(() => {
          setLoginModalOpen(false);
          setLoginEmail(""); setLoginPassword(""); setLoginMessage({ text: "", type: "" });
        }, 600);
      } else setLoginMessage({ text: result.data.error || "Неверный email или пароль", type: "error" });
    }, [loginEmail, loginPassword, setLoggedIn, loadSessionsFromDB]);
  
    const handleSignOut = useCallback(() => {
      setLoggedOut();
      setChatSessions([]); chatSessionsRef.current = [];
      setCurrentSessionId(null); currentSessionIdRef.current = null;
      setLastDocumentIds([]); clearAttachedFiles(); setChatMessages([]); setView("welcome");
      setProfileModalOpen(false); showToast("Вы вышли из аккаунта");
    }, [setLoggedOut, clearAttachedFiles, showToast]);
  
    const handleDeleteAccount = useCallback(async () => {
      if (!authTokenRef.current) return;
      setDeleteLoading(true);
      const ok = await apiDeleteAccount(authTokenRef.current);
      setDeleteLoading(false);
      if (ok) {
        setLoggedOut(); setDeleteModalOpen(false);
        setChatSessions([]); chatSessionsRef.current = [];
        setCurrentSessionId(null); currentSessionIdRef.current = null;
        setLastDocumentIds([]); clearAttachedFiles(); setChatMessages([]); setView("welcome");
        showToast("Аккаунт удалён", "error");
    } else { showToast("Ошибка удаления аккаунта", "error"); setDeleteModalOpen(false); }
  }, [setLoggedOut, clearAttachedFiles, showToast]);

  const deleteSession = useCallback(async (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.dbId && authTokenRef.current) await apiDeleteSession(authTokenRef.current, item.dbId);
    const next = chatSessionsRef.current.filter((s) => s.id !== item.id);
    setChatSessions(next); chatSessionsRef.current = next;
    setPinnedSessionIds((prev) => {
      const filtered = prev.filter((id) => id !== item.id);
      try { localStorage.setItem(PINNED_KEY, JSON.stringify(filtered)); } catch {}
      return filtered;
    });
    if (currentSessionIdRef.current === item.id) {
      setCurrentSessionId(null); currentSessionIdRef.current = null;
      setLastDocumentIds([]); setChatMessages([]); setView("welcome");
    }
  }, []);

  // ── History with pinned sorting ─────────────────────────────────────────
  const { pinned, today, week, month } = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(todayStart.getTime() - 7 * 86400000);
    const monthAgo = new Date(todayStart.getTime() - 30 * 86400000);
    const p: HistoryItem[] = [], t: HistoryItem[] = [], w: HistoryItem[] = [], m: HistoryItem[] = [];
    chatSessions.forEach((s) => {
      const d = new Date(s.lastActivity);
      const item: HistoryItem = { id: s.id, dbId: s.dbId, title: s.title, time: d };
      if (pinnedSessionIds.includes(s.id)) { p.push(item); return; }
      if (d >= todayStart) t.push(item);
      else if (d >= weekAgo) w.push(item);
      else if (d >= monthAgo) m.push(item);
    });
    return { pinned: p.reverse(), today: t.reverse(), week: w.reverse(), month: m.reverse() };
  }, [chatSessions, pinnedSessionIds]);

  const renderHistorySection = (items: HistoryItem[], isPinnedSection = false) =>
    items.map((item) => {
      const isPinned = pinnedSessionIds.includes(item.id);
      return (
        <div key={item.id} className={"history-item" + (isPinned ? " pinned" : "")}>
          <span className="history-item-title" title={item.time.toLocaleString("ru-RU")} onClick={() => loadSession(item.id)}>
            {item.title}
          </span>
          <div className="history-item-actions">
            <button
              className={"history-item-action-btn" + (isPinned ? " pin-active" : "")}
              title={isPinned ? "Открепить" : "Закрепить"}
              onClick={(e) => togglePinSession(item.id, e)}
            >
              <StarIcon size={13} filled={isPinned} />
            </button>
            <button className="history-item-action-btn del" title="Удалить" onClick={(e) => deleteSession(item, e)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>
          </div>
        </div>
      );
    });

  // ── Render file chips ───────────────────────────────────────────────────
  const renderAttachmentChips = (msg: ChatMessage) => {
    if (!msg.attachments?.length) return null;
    return (
      <div className="msg-file-chips">
        {msg.attachments.map((file, idx) => (
          <div key={idx} className="msg-file-chip">
            <span className="msg-chip-icon">{getFileIconComponent(file.name, 14)}</span>
            <span className="msg-chip-name" title={`${file.name} (${formatSize(file.size)})`}>{file.name}</span>
            <span className="msg-chip-size">{formatSize(file.size)}</span>
          </div>
        ))}
      </div>
    );
  };

  // ── Render chat message ─────────────────────────────────────────────────
  const renderChatMessage = (msg: ChatMessage) => {
    const timeStr = (msg.time instanceof Date ? msg.time : new Date(msg.time))
      .toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

    let bubbleHtml: string;
    if (msg.isHtml) bubbleHtml = msg.text;
    else if (msg.sender === "ai") bubbleHtml = processAiText(msg.text);
    else bubbleHtml = escapeHtml(msg.text);

    const hasBubble = msg.text && msg.text.trim().length > 0;

    return (
      <div key={msg.id} className={"message " + msg.sender}>
        <div className="message-avatar">{msg.sender === "user" ? "Вы" : "AI"}</div>
        <div className="message-content">
          {msg.sender === "user" && renderAttachmentChips(msg)}
          {hasBubble && (
            <div className="message-bubble" dangerouslySetInnerHTML={{ __html: bubbleHtml }} />
          )}
          <div className="message-meta">
            {msg.sender === "ai" && (
              <button
                className="copy-btn"
                title="Скопировать"
                onClick={() => {
                  const d = document.createElement("div");
                  d.innerHTML = bubbleHtml;
                  navigator.clipboard.writeText(d.textContent || "")
                    .then(() => showToast("Скопировано!", "success", 1500))
                    .catch(() => showToast("Не удалось скопировать", "error"));
                }}
              >
                <CopyIcon />
              </button>
            )}
            <span className="message-time">{timeStr}</span>
          </div>
        </div>
      </div>
    );
  };

  // ── Sidebar buttons config ──────────────────────────────────────────────
  const cmdButtons = [
    { cmd: "analyze", icon: <AnalyzeIcon />, label: "Анализ" },
    { cmd: "summary", icon: <SummaryIcon />, label: "Сводка" },
    { cmd: "report",  icon: <ReportIcon />,  label: "Отчёт" },
    { cmd: "chart",   icon: <ChartIcon />,   label: "Диаграмма" },
    { cmd: "excel",   icon: <ExcelCmdIcon />, label: "Excel" },
    { cmd: "pdf",     icon: <PdfCmdIcon />, label: "PDF" },
    { cmd: "compare", icon: <CompareIcon />, label: "Сравнить" },
    { cmd: "extract", icon: <ExtractIcon />, label: "Таблицы" },
  ];
  const acctButtons = [
    { action: "salary",  icon: <SalaryIcon />,  label: "Расчёт зарплаты" },
    { action: "tax",     icon: <TaxIcon />,     label: "Налоговый расчёт" },
    { action: "balance", icon: <BalanceIcon />, label: "Баланс проводок" },
    { action: "audit",   icon: <AuditIcon />,   label: "Аудит документа" },
  ];

  // ── Command Palette items ───────────────────────────────────────────────
  const paletteItems: PaletteItem[] = useMemo(() => [
    { id: "new",      title: "Новый чат",          desc: "Создать новый диалог",         section: "Навигация", icon: <NewChatIcon />, action: () => { handleNavNewDoc(); setPaletteOpen(false); } },
    { id: "upload",   title: "Загрузить документ", desc: "Открыть выбор файла",          section: "Навигация", icon: <UploadIcon size={18} />, action: () => { fileUploadRef.current?.click(); setPaletteOpen(false); } },
    { id: "docs",     title: "Документы",          desc: "Все загруженные документы",    section: "Навигация", icon: <ListIcon />, action: () => { handleNavList(); setPaletteOpen(false); } },
    { id: "reports",  title: "Отчёты",             desc: "История отчётов",              section: "Навигация", icon: <ReportsIcon />, action: () => { handleNavReports(); setPaletteOpen(false); } },
    { id: "analyze",  title: "Анализировать",      desc: "Проанализировать документ",    section: "Команды",   icon: <AnalyzeIcon />, action: () => { executeCommand("analyze"); setPaletteOpen(false); } },
    { id: "summary",  title: "Краткое содержание", desc: "Сводка по документу",          section: "Команды",   icon: <SummaryIcon />, action: () => { executeCommand("summary"); setPaletteOpen(false); } },
    { id: "report",   title: "Генерация отчёта",   desc: "Полный отчёт с диаграммами",   section: "Команды",   icon: <ReportIcon />, action: () => { executeCommand("report"); setPaletteOpen(false); } },
    { id: "chart",    title: "Построить диаграмму",desc: "Визуализация данных",          section: "Команды",   icon: <ChartIcon />, action: () => { executeCommand("chart"); setPaletteOpen(false); } },
    { id: "excel",    title: "Экспорт в Excel",    desc: "Скачать .xlsx",                section: "Экспорт",   icon: <ExcelCmdIcon />, action: () => { executeCommand("excel"); setPaletteOpen(false); } },
    { id: "pdf",      title: "Экспорт в PDF",      desc: "Скачать .pdf",                 section: "Экспорт",   icon: <PdfCmdIcon />, action: () => { executeCommand("pdf"); setPaletteOpen(false); } },
    { id: "compare",  title: "Сравнить документы",desc: "Нужно 2+ документа",            section: "Команды",   icon: <CompareIcon />, action: () => { executeCommand("compare"); setPaletteOpen(false); } },
    { id: "extract",  title: "Извлечь таблицы",    desc: "Извлечение табличных данных",  section: "Команды",   icon: <ExtractIcon />, action: () => { executeCommand("extract"); setPaletteOpen(false); } },
    { id: "salary",   title: "Расчёт зарплаты",    desc: "С учётом НДФЛ",                section: "Бухгалтеру",icon: <SalaryIcon />, action: () => { executeCommand("salary"); setPaletteOpen(false); } },
    { id: "tax",      title: "Налоговый расчёт",   desc: "НДФЛ + страховые взносы",      section: "Бухгалтеру",icon: <TaxIcon />, action: () => { executeCommand("tax"); setPaletteOpen(false); } },
    { id: "balance",  title: "Баланс проводок",    desc: "Бухгалтерский баланс",         section: "Бухгалтеру",icon: <BalanceIcon />, action: () => { executeCommand("balance"); setPaletteOpen(false); } },
    { id: "audit",    title: "Аудит документа",    desc: "Проверка на ошибки",           section: "Бухгалтеру",icon: <AuditIcon />, action: () => { executeCommand("audit"); setPaletteOpen(false); } },
  ], [executeCommand, handleNavNewDoc, handleNavList, handleNavReports]);

  const filteredPaletteItems = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return paletteItems;
    return paletteItems.filter((it) =>
      it.title.toLowerCase().includes(q) ||
      it.desc.toLowerCase().includes(q) ||
      it.section.toLowerCase().includes(q)
    );
  }, [paletteItems, paletteQuery]);

  // Group palette items by section
  const groupedPalette = useMemo(() => {
    const groups: Record<string, PaletteItem[]> = {};
    filteredPaletteItems.forEach((it) => {
      if (!groups[it.section]) groups[it.section] = [];
      groups[it.section].push(it);
    });
    return groups;
  }, [filteredPaletteItems]);

  // Palette keyboard navigation
  const handlePaletteKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPaletteActiveIdx((i) => Math.min(i + 1, filteredPaletteItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPaletteActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filteredPaletteItems[paletteActiveIdx];
      if (item) item.action();
    }
  }, [filteredPaletteItems, paletteActiveIdx]);

  useEffect(() => { setPaletteActiveIdx(0); }, [paletteQuery]);

  // ── JSX ─────────────────────────────────────────────────────────────────
  return (
    <div className="container">
      {/* SIDEBAR */}
      <aside className={"sidebar" + (sidebarOpen ? " open" : "")} id="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">DocMind<span className="logo-pro">Pro</span></h1>
          <span className="folder-icon"><FolderIcon /></span>
        </div>

        {/* Command Panel */}
        <div className="command-panel">
          <button className="panel-toggle-btn" onClick={() => setCmdPanelOpen((v) => !v)}>
            <span className="panel-title-text"><SparkleIcon size={13} /> Панель команд</span>
            <ChevronIcon open={cmdPanelOpen} />
          </button>
          <div className={"panel-body" + (cmdPanelOpen ? "" : " collapsed")}>
            <div className="command-grid">
              {cmdButtons.map((btn) => (
                <button key={btn.cmd} className="cmd-btn" title={btn.label} onClick={() => executeCommand(btn.cmd)}>
                  {btn.icon}
                  <span className="cmd-label">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Accountant Panel */}
        <div className="quick-actions">
          <button className="panel-toggle-btn" onClick={() => setAcctPanelOpen((v) => !v)}>
            <span className="panel-title-text"><CalculatorIcon size={13} /> Бухгалтеру</span>
            <ChevronIcon open={acctPanelOpen} />
          </button>
          <div className={"panel-body" + (acctPanelOpen ? "" : " collapsed")}>
            <div className="action-list">
              {acctButtons.map((btn) => (
                <button key={btn.action} className="action-btn" onClick={() => executeCommand(btn.action)}>
                  {btn.icon} {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <ul>
            <li onClick={handleNavNewDoc}><span className="icon"><NewChatIcon /></span> Новый чат</li>
            <li onClick={handleNavList}><span className="icon"><ListIcon /></span> Документы</li>
            <li onClick={handleNavSearch}><span className="icon"><SearchIcon /></span> Поиск</li>
            <li onClick={handleNavReports}><span className="icon"><ReportsIcon /></span> Отчёты</li>
          </ul>
        </nav>

        {/* History */}
        <div className="sidebar-sections">
          {pinned.length > 0 && (
            <div className="section">
              <h3>⭐ Закреплённые</h3>
              <div>{renderHistorySection(pinned, true)}</div>
            </div>
          )}
          {today.length > 0 && (
            <div className="section"><h3>Сегодня</h3><div>{renderHistorySection(today)}</div></div>
          )}
          {week.length > 0 && (
            <div className="section"><h3>7 дней</h3><div>{renderHistorySection(week)}</div></div>
          )}
          {month.length > 0 && (
            <div className="section"><h3>30 дней</h3><div>{renderHistorySection(month)}</div></div>
          )}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          {currentUser && (
            <div className="user-profile" onClick={() => setProfileModalOpen(true)}>
              <div className="user-avatar"><UserAvatarIcon /></div>
              <span className="user-email">{currentUser.email}</span>
            </div>
          )}
          <div style={{ fontSize: 11, textAlign: "center", color: "#666", padding: "4px 0" }}>
            {backendOnline === null ? "" : backendOnline
              ? <span style={{ color: "#4ade80" }}>● Online</span>
              : <span style={{ color: "#ff4444" }}>● Offline</span>}
          </div>
          <div className="footer-links">
            <a href="#">Условия</a>
            <a href="#">Конфиденциальность</a>
          </div>
        </div>
      </aside>

      <div className={"sidebar-overlay" + (sidebarOpen ? " active" : "")} onClick={() => setSidebarOpen(false)} />

      {/* MAIN */}
      <main className="main-content">
        <header className="main-header">
          <button className="burger-btn" aria-label="Меню" onClick={() => setSidebarOpen((s) => !s)}>
            <BurgerIcon />
          </button>
          <div className="header-badges">
            <span className="badge badge-pro"><SparkleIcon size={10} /> Pro</span>
            <span className="badge badge-role">Бухгалтерия</span>
          </div>
          {!currentUser && (
            <button className="login-btn" onClick={() => setLoginModalOpen(true)}>Войти</button>
          )}
        </header>

        <div className="chat-container">
          {/* 🔥 DRAG OVERLAY */}
          <div className={"drag-overlay" + (isDragging ? " active" : "")}>
            <div className="drag-overlay-inner">
              <div className="drag-overlay-icon"><UploadIcon size={56} /></div>
              <div className="drag-overlay-title">Отпустите файл здесь</div>
              <div className="drag-overlay-subtitle">PDF, Word, Excel, изображения — до {MAX_FILES} файлов</div>
            </div>
          </div>

          {/* WELCOME */}
          {view === "welcome" && (
            <div className="welcome-screen">
              <div className="welcome-content">
                <div className="title-wrapper">
                  <h1 className="main-logo">DocMind<span className="pro-badge">Pro</span></h1>
                </div>
                <p className="welcome-subtitle">AI-ассистент для бухгалтеров и экономистов</p>
                <div className="feature-cards">
                  {[
                    { icon: <UploadIcon />,     title: "Загрузка документов", desc: "PDF, Excel, Word, изображения" },
                    { icon: <ChatIcon />,       title: "Вопросы по документу", desc: "На естественном языке" },
                    { icon: <BarChartIcon />,   title: "Отчёты и диаграммы",   desc: "Автоматическая аналитика" },
                    { icon: <CalculatorIcon />, title: "Бухгалтерские расчёты",desc: "Зарплата, налоги, проводки" },
                  ].map((card) => (
                    <div key={card.title} className="feature-card">
                      <div className="feature-icon">{card.icon}</div>
                      <h3>{card.title}</h3>
                      <p>{card.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="quick-start">
                  <p className="quick-start-title"><SparkleIcon /> Быстрый старт</p>
                  <div className="quick-start-buttons">
                    <button className="qs-btn" onClick={() => { if (fileUploadRef.current) { fileUploadRef.current.value = ""; fileUploadRef.current.click(); } }}>
                      <UploadIcon size={16} /> Загрузить документ
                    </button>
                    <button className="qs-btn" onClick={() => executeCommand("analyze")}>
                      <AnalyzeIcon size={16} /> Анализировать
                    </button>
                    <button className="qs-btn" onClick={() => executeCommand("report")}>
                      <ReportIcon size={16} /> Создать отчёт
                    </button>
                  </div>
                </div>
                <div className="hotkey-hint">
                  Совет: нажмите <span className="kbd">⌘</span> <span className="kbd">K</span> для быстрого поиска команд
                  или перетащите файл <span className="kbd">сюда</span>
                </div>
              </div>
            </div>
          )}

          {/* CHAT */}
          {view === "chat" && (
            <div className="chat-messages" id="chat-messages">
              {chatMessages.length === 0 && !isRestoring && (
                <div className="message ai">
                  <div className="message-avatar">AI</div>
                  <div className="message-content">
                    <div className="message-bubble">Начните диалог — загрузите документ или задайте вопрос!</div>
                  </div>
                </div>
              )}
              {chatMessages.map(renderChatMessage)}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* DOCUMENTS */}
          {view === "documents" && (
            <div className="chat-messages">
              {documents.length === 0 ? (
                <div className="message ai"><div className="message-avatar">AI</div>
                  <div className="message-content"><div className="message-bubble">Документов нет. Загрузите файл или перетащите его в окно.</div></div>
                </div>
              ) : (
                <>
                  <div className="message ai"><div className="message-avatar">AI</div>
                    <div className="message-content"><div className="message-bubble" dangerouslySetInnerHTML={{ __html: `<b>Ваши документы (${documents.length}):</b>` }} /></div>
                  </div>
                  {documents.map((doc, i) => {
                    const name = doc.originalName || doc.filename || `Документ ${i + 1}`;
                                        const info = [
                      doc.size ? formatSize(doc.size) : "",
                      doc.status || "",
                      doc.createdAt ? formatDate(doc.createdAt) : "",
                    ].filter(Boolean).join(" • ");
                    return (
                      <div key={doc.id} className="message ai">
                        <div className="message-avatar">{i + 1}</div>
                        <div className="message-content">
                          <div className="message-bubble">
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              {getFileIconComponent(name, 20)}
                              <b>{name}</b>
                            </div>
                            <div style={{ fontSize: 12, color: "#888" }}>{info}</div>
                            <div className="doc-preview-actions">
                              <button onClick={() => {
                                setLastDocumentIds([doc.id]); setCurrentSessionId(null); currentSessionIdRef.current = null;
                                setChatMessages([]); setView("chat");
                                addMessageToSession("ai", "Выбран документ. Задайте вопрос по содержимому.");
                              }}><ChatIcon size={13} /> Вопрос</button>
                              <button onClick={() => {
                                setLastDocumentIds([doc.id]); setCurrentSessionId(null); currentSessionIdRef.current = null;
                                setChatMessages([]); setView("chat"); executeCommand("report");
                              }}><ReportIcon size={13} /> Отчёт</button>
                              <button onClick={() => {
                                setLastDocumentIds([doc.id]); setCurrentSessionId(null); currentSessionIdRef.current = null;
                                setChatMessages([]); setView("chat"); executeCommand("analyze");
                              }}><AnalyzeIcon size={13} /> Анализ</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* REPORTS */}
          {view === "reports" && (
            <div className="chat-messages">
              {reports.length === 0 ? (
                <div className="message ai"><div className="message-avatar">AI</div>
                  <div className="message-content"><div className="message-bubble">Отчётов пока нет. Загрузите документ и создайте отчёт!</div></div>
                </div>
              ) : (
                <>
                  <div className="message ai"><div className="message-avatar">AI</div>
                    <div className="message-content"><div className="message-bubble" dangerouslySetInnerHTML={{ __html: `<b>Ваши отчёты (${reports.length}):</b>` }} /></div>
                  </div>
                  {reports.map((report, i) => (
                    <div key={report.id} className="message ai">
                      <div className="message-avatar">{i + 1}</div>
                      <div className="message-content">
                        <div className="message-bubble">
                          <b>{report.title || "Отчёт"}</b><br/>
                          <span style={{ fontSize: 12, color: "#888" }}>
                            {(report.type || "отчёт").toUpperCase()} • {formatDate(report.createdAt)}
                          </span>
                          {report.fileUrl && (
                            <div style={{ marginTop: 8 }}>
                              <a href={report.fileUrl} download className="report-file-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                  <polyline points="7 10 12 15 17 10"/>
                                  <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                Скачать
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* INPUT AREA */}
          <div className="chat-input-container">
            <input type="file" accept=".pdf,.docx,.xlsx,.xls,.txt,.csv,.jpg,.jpeg,.png" style={{ display: "none" }} multiple ref={fileUploadRef} onChange={(e) => addFilesToList(e.target.files)} />
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} ref={cameraRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) { addFilesToList(e.target.files); autoUploadFromCamera(f); } }} />
            <input type="file" accept="image/*" style={{ display: "none" }} multiple ref={galleryRef} onChange={(e) => addFilesToList(e.target.files)} />

            {attachedFiles.length > 0 && (
              <div className="attached-files-bar">
                {attachedFiles.map((file, index) => (
                  <div key={`${file.name}-${file.size}-${index}`} className="attached-file-chip">
                    <span className="chip-icon">{getFileIconComponent(file.name, 14)}</span>
                    <span className="chip-name" title={`${file.name} (${formatSize(file.size)})`}>{file.name}</span>
                    <button className="chip-remove" title="Удалить" onClick={() => removeAttachedFile(index)}>×</button>
                  </div>
                ))}
                {attachedFiles.length > 1 && (
                  <span className="attached-files-count">{attachedFiles.length}/{MAX_FILES}</span>
                )}
              </div>
            )}

            <div className="input-wrapper">
              <textarea
                className="chat-input"
                placeholder="Напишите сообщение, перетащите файл или нажмите ⌘K..."
                rows={1}
                ref={chatInputRef}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                  e.target.style.overflowY = e.target.scrollHeight > 200 ? "auto" : "hidden";
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              />
              <div className="input-options">
                <button className="option-btn" title="Прикрепить файл" onClick={() => { if (fileUploadRef.current) { fileUploadRef.current.value = ""; fileUploadRef.current.click(); } }}>
                  <AttachIcon />
                </button>
                <button className="option-btn" title="Камера" onClick={() => { if (cameraRef.current) { cameraRef.current.value = ""; cameraRef.current.click(); } }}>
                  <CameraIcon />
                </button>
                <button className="option-btn" title="Галерея" onClick={() => { if (galleryRef.current) { galleryRef.current.value = ""; galleryRef.current.click(); } }}>
                  <GalleryIcon />
                </button>
              </div>
              <button className="send-btn" onClick={sendMessage} title="Отправить (Enter)">
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 🔥 COMMAND PALETTE (Cmd+K) */}
      {paletteOpen && (
        <div className="cmd-palette-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPaletteOpen(false); }}>
          <div className="cmd-palette">
            <div className="cmd-palette-search">
              <SearchIcon />
              <input
                ref={paletteInputRef}
                className="cmd-palette-input"
                placeholder="Поиск команд..."
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                onKeyDown={handlePaletteKeyDown}
              />
              <span className="cmd-palette-esc">ESC</span>
            </div>
            <div className="cmd-palette-list">
              {filteredPaletteItems.length === 0 ? (
                <div className="cmd-palette-empty">Ничего не найдено</div>
              ) : (
                Object.entries(groupedPalette).map(([section, items]) => (
                  <div key={section}>
                    <div className="cmd-palette-section">{section}</div>
                    {items.map((item) => {
                      const globalIdx = filteredPaletteItems.indexOf(item);
                      return (
                        <div
                          key={item.id}
                          className={"cmd-palette-item" + (globalIdx === paletteActiveIdx ? " active" : "")}
                          onClick={item.action}
                          onMouseEnter={() => setPaletteActiveIdx(globalIdx)}
                        >
                          <div className="cmd-palette-item-icon">{item.icon}</div>
                          <div className="cmd-palette-item-text">
                            <div className="cmd-palette-item-title">{item.title}</div>
                            <div className="cmd-palette-item-desc">{item.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {loginModalOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setLoginModalOpen(false); }}>
          <div className="modal-container">
            <button className="modal-close" onClick={() => setLoginModalOpen(false)}>×</button>
            <div className="modal-content">
              <div className="modal-tabs">
                <button className={"modal-tab" + (activeTab === "register" ? " active" : "")} onClick={() => setActiveTab("register")}>Регистрация</button>
                <button className={"modal-tab" + (activeTab === "login" ? " active" : "")} onClick={() => setActiveTab("login")}>Вход</button>
              </div>
              {activeTab === "register" && (
                <div className="tab-panel active">
                  {regMessage.text && <div className={"auth-message " + regMessage.type}>{regMessage.text}</div>}
                  <div className="modal-input-wrapper"><input type="email" className="modal-input" placeholder="Email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} /></div>
                  <div className="modal-input-wrapper"><input type="password" className="modal-input" placeholder="Пароль (мин. 4 символа)" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} /></div>
                  <div className="modal-input-wrapper"><input type="password" className="modal-input" placeholder="Подтвердите пароль" value={regPassword2} onChange={(e) => setRegPassword2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleRegister(); }} /></div>
                  <button className="modal-btn" onClick={handleRegister} disabled={registerLoading}>
                    {registerLoading ? <><span className="btn-spinner" />Регистрация...</> : "Зарегистрироваться"}
                  </button>
                </div>
              )}
              {activeTab === "login" && (
                <div className="tab-panel active">
                  {loginMessage.text && <div className={"auth-message " + loginMessage.type}>{loginMessage.text}</div>}
                  <div className="modal-input-wrapper"><input type="email" className="modal-input" placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} /></div>
                  <div className="modal-input-wrapper"><input type="password" className="modal-input" placeholder="Пароль" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }} /></div>
                  <button className="modal-btn" onClick={handleLogin} disabled={loginLoading}>
                    {loginLoading ? <><span className="btn-spinner" />Входим...</> : "Войти"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {profileModalOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setProfileModalOpen(false); }}>
          <div className="profile-modal-container">
            <button className="modal-close" onClick={() => setProfileModalOpen(false)}>×</button>
            <div className="profile-header">
              <div className="profile-avatar-large">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="#4ade80" strokeWidth="2" />
                  <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="profile-email">{currentUser?.email}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>ID: {currentUser?.id?.substring(0, 8)}...</div>
            </div>
            <div className="profile-actions">
              <button className="profile-btn sign-out-btn" onClick={handleSignOut}><SignOutIcon />Выйти</button>
              <button className="profile-btn delete-account-btn" onClick={() => { setProfileModalOpen(false); setDeleteModalOpen(true); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
                </svg>
                Удалить аккаунт
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteModalOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDeleteModalOpen(false); }}>
          <div className="modal-container">
            <button className="modal-close" onClick={() => setDeleteModalOpen(false)}>×</button>
            <div className="modal-content">
              <h2 className="modal-title">Удалить аккаунт?</h2>
              <p className="modal-subtitle">Это действие нельзя отменить. Все данные будут удалены.</p>
              <div className="delete-confirm-actions">
                <button className="modal-btn cancel-btn" onClick={() => setDeleteModalOpen(false)}>Отмена</button>
                <button className="modal-btn delete-confirm-btn" onClick={handleDeleteAccount} disabled={deleteLoading}>
                  {deleteLoading ? <><span className="btn-spinner" />Удаление...</> : "Удалить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      <div className={"toast" + (toast.show ? " show" : "") + (toast.type !== "default" ? " " + toast.type : "")}>
        {toast.msg}
      </div>
    </div>
  );
}