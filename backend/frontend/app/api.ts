import { ApiResult } from "./types";

// 🔥 Базовый URL API. Если задан NEXT_PUBLIC_API_URL — ходим напрямую на бэк, минуя rewrites Next.js
// (rewrites имеют свой таймаут ~2 мин, поэтому для долгих запросов лучше идти напрямую).
// Создай файл backend/frontend/.env.local со строкой:
//    NEXT_PUBLIC_API_URL=http://localhost:5000
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Универсальный таймаут для долгих запросов (генерация отчётов, AI-ответы)
const LONG_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("docmind_token") : null;
  return token ? { Authorization: "Bearer " + token } : {};
}

// Утилита: fetch с AbortController
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = LONG_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============ AUTH ============
export async function apiRegister(email: string, password: string): Promise<ApiResult> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

export async function apiLogin(email: string, password: string): Promise<ApiResult> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

export async function apiGetMe(token: string) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: "Bearer " + token },
    });
    if (res.ok) return (await res.json()).user;
  } catch {}
  return null;
}

export async function apiDeleteAccount(token: string) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/account`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ============ CHAT SESSIONS ============
export async function apiLoadSessions(token: string) {
  try {
    const res = await fetch(`${API_BASE}/api/chat/sessions`, {
      headers: { Authorization: "Bearer " + token },
    });
    if (res.ok) return (await res.json()).sessions || [];
  } catch {}
  return [];
}

export async function apiCreateSession(token: string, title: string) {
  try {
    const res = await fetch(`${API_BASE}/api/chat/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ title }),
    });
    if (res.ok) return (await res.json()).session;
  } catch {}
  return null;
}

export async function apiSaveMessage(
  token: string,
  sessionId: string,
  sender: string,
  text: string,
  isHtml = false
) {
  try {
    await fetch(`${API_BASE}/api/chat/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ sender, text, isHtml }),
    });
  } catch {}
}

export async function apiUpdateSessionTitle(token: string, sessionId: string, title: string) {
  try {
    await fetch(`${API_BASE}/api/chat/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ title }),
    });
  } catch {}
}

export async function apiDeleteSession(token: string, sessionId: string) {
  try {
    await fetch(`${API_BASE}/api/chat/sessions/${sessionId}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
  } catch {}
}

export async function apiUpdateSessionDocuments(
  token: string,
  sessionId: string,
  documentIds: string[]
) {
  try {
    await fetch(`${API_BASE}/api/chat/sessions/${sessionId}/documents`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ documentIds }),
    });
  } catch {}
}

// ============ DOCUMENTS ============
export async function uploadFileToBackend(token: string | null, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    // Загрузка файла может занять время — даём 5 минут
    const res = await fetchWithTimeout(
      `${API_BASE}/api/upload`,
      { method: "POST", headers, body: formData },
      LONG_TIMEOUT_MS
    );
    return { success: res.ok, data: await res.json() };
  } catch (e: any) {
    if (e.name === "AbortError") {
      return { success: false, error: "Превышено время ожидания загрузки (5 минут)" };
    }
    return { success: false, error: e.message };
  }
}

export async function loadDocumentsFromBackend(token: string | null) {
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch(`${API_BASE}/api/documents`, { headers });
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || data.documents || [];
  } catch {
    return [];
  }
}

// ============ AI / REPORTS / COMMANDS — с длинным таймаутом ============
export async function apiAskQuestion(question: string, docIds: string[]) {
  try {
    const body: any = { question };
    if (docIds.length === 1) body.documentId = docIds[0];
    else if (docIds.length > 1) {
      body.documentIds = docIds;
      body.documentId = docIds[docIds.length - 1];
    }
    const res = await fetchWithTimeout(
      `${API_BASE}/api/ask`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      },
      LONG_TIMEOUT_MS
    );
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        answer:
          (data.data && data.data.answer) ||
          data.answer ||
          data.response ||
          JSON.stringify(data),
      };
    }
    return { success: false, error: "Сервер не смог ответить" };
  } catch (e: any) {
    if (e.name === "AbortError") {
      return { success: false, error: "Превышено время ожидания (5 минут)" };
    }
    return { success: false, error: "Ошибка сети" };
  }
}

export async function apiGenerateReport(documentId: string, type = "all") {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/reports/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ documentId, type }),
      },
      LONG_TIMEOUT_MS
    );
    if (res.ok) {
      const data = await res.json();
      return { success: true, data: data.data || data };
    }
    const err = await res.json().catch(() => ({}));
    return {
      success: false,
      error: err.message || err.error || "Ошибка генерации отчёта",
    };
  } catch (e: any) {
    if (e.name === "AbortError") {
      return { success: false, error: "Превышено время ожидания (5 минут)" };
    }
    return { success: false, error: e.message };
  }
}

export async function apiGenerateReportMulti(documentIds: string[], type = "all") {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/reports/generate-multi`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ documentIds, type }),
      },
      LONG_TIMEOUT_MS
    );
    if (res.ok) {
      const data = await res.json();
      return { success: true, data: data.data || data };
    }
    const err = await res.json().catch(() => ({}));
    return {
      success: false,
      error:
        err.message || err.error || "Ошибка генерации объединённого отчёта",
    };
  } catch (e: any) {
    if (e.name === "AbortError") {
      return { success: false, error: "Превышено время ожидания (5 минут)" };
    }
    return { success: false, error: e.message };
  }
}

export async function apiRunCommand(command: string, documentId: string, params = {}) {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/api/commands/run`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ command, documentId, params }),
      },
      LONG_TIMEOUT_MS
    );
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data ?? json };
    }
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.error || "Ошибка выполнения команды" };
  } catch (e: any) {
    if (e.name === "AbortError") {
      return { success: false, error: "Превышено время ожидания (5 минут)" };
    }
    return { success: false, error: e.message };
  }
}