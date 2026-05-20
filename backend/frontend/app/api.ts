import { ApiResult } from "./types";

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("docmind_token") : null;
  return token ? { Authorization: "Bearer " + token } : {};
}

export async function apiRegister(email: string, password: string): Promise<ApiResult> {
  const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

export async function apiLogin(email: string, password: string): Promise<ApiResult> {
  const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

export async function apiGetMe(token: string) {
  try {
    const res = await fetch("/api/auth/me", { headers: { Authorization: "Bearer " + token } });
    if (res.ok) return (await res.json()).user;
  } catch {}
  return null;
}

export async function apiDeleteAccount(token: string) {
  try {
    const res = await fetch("/api/auth/account", { method: "DELETE", headers: { Authorization: "Bearer " + token } });
    return res.ok;
  } catch { return false; }
}

export async function apiLoadSessions(token: string) {
  try {
    const res = await fetch("/api/chat/sessions", { headers: { Authorization: "Bearer " + token } });
    if (res.ok) return (await res.json()).sessions || [];
  } catch {}
  return [];
}

export async function apiCreateSession(token: string, title: string) {
  try {
    const res = await fetch("/api/chat/sessions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ title }) });
    if (res.ok) return (await res.json()).session;
  } catch {}
  return null;
}

export async function apiSaveMessage(token: string, sessionId: string, sender: string, text: string, isHtml = false) {
  try {
    await fetch("/api/chat/sessions/" + sessionId + "/messages", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ sender, text, isHtml }) });
  } catch {}
}

export async function apiUpdateSessionTitle(token: string, sessionId: string, title: string) {
  try {
    await fetch("/api/chat/sessions/" + sessionId, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ title }) });
  } catch {}
}

export async function apiDeleteSession(token: string, sessionId: string) {
  try {
    await fetch("/api/chat/sessions/" + sessionId, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
  } catch {}
}

export async function uploadFileToBackend(token: string | null, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch("/api/upload", { method: "POST", headers, body: formData });
    return { success: res.ok, data: await res.json() };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function loadDocumentsFromBackend(token: string | null) {
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch("/api/documents", { headers });
    const data = await res.json();
    return Array.isArray(data) ? data : (data.data || data.documents || []);
  } catch { return []; }
}

export async function apiAskQuestion(question: string, docIds: string[]) {
  try {
    const body: any = { question };
    if (docIds.length === 1) body.documentId = docIds[0];
    else if (docIds.length > 1) { body.documentIds = docIds; body.documentId = docIds[docIds.length - 1]; }
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, answer: (data.data && data.data.answer) || data.answer || data.response || JSON.stringify(data) };
    }
    return { success: false, error: "Сервер не смог ответить" };
  } catch { return { success: false, error: "Ошибка сети" }; }
}

export async function apiGenerateReport(documentId: string, type = "all") {
  try {
    const res = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ documentId, type })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, data: data.data || data };
    }
    return { success: false, error: "Ошибка генерации отчёта" };
  } catch (e: any) { return { success: false, error: e.message }; }
}


export async function apiRunCommand(command: string, documentId: string, params = {}) {
  try {
    const res = await fetch("/api/commands/run", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ command, documentId, params }),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data ?? json };
    }
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.error || "Ошибка выполнения команды" };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function apiUpdateSessionDocuments(token: string, sessionId: string, documentIds: string[]) {
  try {
    await fetch("/api/chat/sessions/" + sessionId + "/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ documentIds })
    });
  } catch {}
}