"use client";

import {
  type User,
  type Session,
  type ChatMessage,
  type DataFile,
  type GeneratedReport,
  type AuthResponse,
} from "./types";

// ═══════════════════════════════════════════════════
//  КОНФИГУРАЦИЯ API
//  Поменяй MOCK_MODE на false и BASE_URL на свой бэкенд
// ═══════════════════════════════════════════════════
const MOCK_MODE = true;
const BASE_URL = MOCK_MODE ? "/api/mock" : "http://localhost:5000/api";

async function fetcher<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("da_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ═══════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════
export async function apiRegister(email: string, password: string): Promise<AuthResponse> {
  if (MOCK_MODE) {
    await delay(600);
    const user = mockUser(email);
    const token = "mock_token_" + user.id;
    localStorage.setItem("da_token", token);
    return { token, user };
  }
  const data = await fetcher<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem("da_token", data.token);
  return data;
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  if (MOCK_MODE) {
    await delay(600);
    const user = mockUser(email);
    const token = "mock_token_" + user.id;
    localStorage.setItem("da_token", token);
    return { token, user };
  }
  const data = await fetcher<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem("da_token", data.token);
  return data;
}

export async function apiGetMe(): Promise<User | null> {
  if (MOCK_MODE) {
    await delay(300);
    const token = localStorage.getItem("da_token");
    if (!token) return null;
    return mockUser("user@example.com");
  }
  try {
    return await fetcher<User>("/auth/me", { headers: authHeaders() });
  } catch {
    return null;
  }
}

export async function apiUpdateProfile(name: string): Promise<User> {
  if (MOCK_MODE) {
    await delay(400);
    return { ...mockUser("user@example.com"), name };
  }
  return fetcher<User>("/auth/profile", {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
}

export async function apiChangePassword(oldPassword: string, newPassword: string): Promise<void> {
  if (MOCK_MODE) {
    await delay(400);
    if (oldPassword !== "password") throw new Error("Неверный текущий пароль");
    return;
  }
  await fetcher("/auth/password", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

export async function apiDeleteAccount(): Promise<boolean> {
  if (MOCK_MODE) {
    await delay(500);
    localStorage.removeItem("da_token");
    return true;
  }
  const res = await fetch(`${BASE_URL}/auth/account`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return res.ok;
}

// ═══════════════════════════════════════════════════
//  SESSIONS
// ═══════════════════════════════════════════════════
export async function apiLoadSessions(): Promise<Session[]> {
  if (MOCK_MODE) {
    await delay(400);
    return mockSessions();
  }
  return fetcher<Session[]>("/sessions", { headers: authHeaders() });
}

export async function apiCreateSession(title: string): Promise<Session> {
  if (MOCK_MODE) {
    await delay(300);
    return { id: "sess_" + Date.now(), title, userId: "u1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }
  return fetcher<Session>("/sessions", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  });
}

export async function apiDeleteSession(id: string): Promise<void> {
  if (MOCK_MODE) {
    await delay(300);
    return;
  }
  await fetcher(`/sessions/${id}`, { method: "DELETE", headers: authHeaders() });
}

export async function apiUpdateSessionTitle(id: string, title: string): Promise<void> {
  if (MOCK_MODE) {
    await delay(200);
    return;
  }
  await fetcher(`/sessions/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  });
}

// ═══════════════════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════════════════
export async function apiSendMessage(
  sessionId: string,
  content: string,
  fileIds?: string[]
): Promise<ChatMessage> {
  if (MOCK_MODE) {
    await delay(1200);
    return mockAssistantMessage(sessionId, content, fileIds);
  }
  return fetcher<ChatMessage>("/chat", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ sessionId, content, fileIds }),
  });
}

export async function apiLoadMessages(sessionId: string): Promise<ChatMessage[]> {
  if (MOCK_MODE) {
    await delay(400);
    return mockMessages(sessionId);
  }
  return fetcher<ChatMessage[]>(`/chat/${sessionId}/messages`, { headers: authHeaders() });
}

// ═══════════════════════════════════════════════════
//  FILES
// ═══════════════════════════════════════════════════
export async function apiUploadFile(file: File): Promise<DataFile> {
  if (MOCK_MODE) {
    await delay(1500);
    return mockDataFile(file.name, file.size);
  }
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/files/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export async function apiLoadFiles(): Promise<DataFile[]> {
  if (MOCK_MODE) {
    await delay(400);
    return mockFiles();
  }
  return fetcher<DataFile[]>("/files", { headers: authHeaders() });
}

export async function apiGetFileData(fileId: string): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  if (MOCK_MODE) {
    await delay(600);
    return mockFileData();
  }
  return fetcher(`/files/${fileId}/data`, { headers: authHeaders() });
}

// ═══════════════════════════════════════════════════
//  REPORTS
// ═══════════════════════════════════════════════════
export async function apiGenerateReport(
  sessionId: string,
  prompt: string
): Promise<GeneratedReport> {
  if (MOCK_MODE) {
    await delay(2000);
    return {
      id: "rep_" + Date.now(),
      messageId: "msg_" + Date.now(),
      filename: "report_" + Date.now() + ".xlsx",
      fileUrl: "#",
      createdAt: new Date().toISOString(),
    };
  }
  return fetcher<GeneratedReport>(`/chat/${sessionId}/report`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ prompt }),
  });
}

// ═══════════════════════════════════════════════════
//  HELPERS & MOCKS
// ═══════════════════════════════════════════════════
function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function mockUser(email: string): User {
  return { id: "u_" + Math.random().toString(36).slice(2, 8), email, createdAt: new Date().toISOString() };
}

function mockSessions(): Session[] {
  return [
    { id: "s1", title: "Анализ продаж Q1", userId: "u1", createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date().toISOString() },
    { id: "s2", title: "Финансовый отчёт", userId: "u1", createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
  ];
}

function mockMessages(sessionId: string): ChatMessage[] {
  return [
    { id: "m1", sessionId, role: "user", content: "Привет, покажи выручку по месяцам", createdAt: new Date(Date.now() - 600000).toISOString() },
    { id: "m2", sessionId, role: "assistant", content: "Вот агрегированные данные по выручке:\n\n| Месяц | Выручка |\n|-------|---------|\n| Янв   | 1.2M    |\n| Фев   | 1.5M    |\n| Мар   | 1.3M    |", createdAt: new Date(Date.now() - 590000).toISOString() },
  ];
}

function mockAssistantMessage(sessionId: string, userContent: string, _fileIds?: string[]): ChatMessage {
  const responses = [
    "На основе загруженного датасета:\n\n- Средняя выручка: **1.33M**\n- Медиана: **1.3M**\n- Рост MoM: **+8.3%**",
    "Построил сводную таблицу. Ключевые метрики:\n- SUM: 4.0M\n- AVG: 1.33M\n- MAX: 1.5M (февраль)",
    "Корреляция между колонками **Выручка** и **Прибыль** составляет **0.87** — сильная положительная связь.",
  ];
  const text = responses[Math.floor(Math.random() * responses.length)];
  return { id: "m_" + Date.now(), sessionId, role: "assistant", content: text, createdAt: new Date().toISOString() };
}

function mockDataFile(name: string, size: number): DataFile {
  return {
    id: "f_" + Math.random().toString(36).slice(2, 8),
    filename: name,
    originalName: name,
    fileSize: size,
    rowCount: 1240,
    columns: [
      { name: "Дата", type: "date", sample: "2024-01-15" },
      { name: "Регион", type: "string", sample: "Москва" },
      { name: "Выручка", type: "number", sample: 1250000 },
      { name: "Прибыль", type: "number", sample: 320000 },
    ],
    createdAt: new Date().toISOString(),
  };
}

function mockFiles(): DataFile[] {
  return [
    { id: "f1", filename: "sales_q1.xlsx", originalName: "sales_q1.xlsx", fileSize: 45230, rowCount: 1240, columns: [{ name: "Дата", type: "date", sample: "2024-01-01" }, { name: "Регион", type: "string", sample: "МСК" }, { name: "Сумма", type: "number", sample: 100000 }], createdAt: new Date().toISOString() },
    { id: "f2", filename: "costs_2024.csv", originalName: "costs_2024.csv", fileSize: 12800, rowCount: 560, columns: [{ name: "Месяц", type: "string", sample: "Янв" }, { name: "Статья", type: "string", sample: "Аренда" }, { name: "Расход", type: "number", sample: 50000 }], createdAt: new Date().toISOString() },
  ];
}

function mockFileData() {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    Дата: `2024-01-${String(i + 1).padStart(2, "0")}`,
    Регион: ["Москва", "СПб", "Казань", "Новосибирск"][i % 4],
    Выручка: Math.round(800000 + Math.random() * 700000),
    Прибыль: Math.round(150000 + Math.random() * 300000),
  }));
  return { rows, columns: ["Дата", "Регион", "Выручка", "Прибыль"] };
}
