"use client";

import { useState, useCallback } from "react";
import { type ChatMessage, type Session } from "@/lib/types";
import {
  apiLoadSessions,
  apiCreateSession,
  apiDeleteSession,
  apiUpdateSessionTitle,
  apiSendMessage,
  apiLoadMessages,
} from "@/lib/api";

export function useChat() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    const list = await apiLoadSessions();
    setSessions(list);
  }, []);

  const createSession = useCallback(async (title = "Новый чат") => {
    const s = await apiCreateSession(title);
    setSessions((prev) => [s, ...prev]);
    setCurrentSessionId(s.id);
    setMessages([]);
    return s;
  }, []);

  const selectSession = useCallback(async (id: string) => {
    setCurrentSessionId(id);
    setLoading(true);
    const msgs = await apiLoadMessages(id);
    setMessages(msgs);
    setLoading(false);
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    await apiDeleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
      setMessages([]);
    }
  }, [currentSessionId]);

  const sendMessage = useCallback(
    async (content: string, fileIds?: string[]) => {
      let sid = currentSessionId;
      if (!sid) {
        const s = await createSession(content.slice(0, 40));
        sid = s.id;
      }
      const userMsg: ChatMessage = {
        id: "local_" + Date.now(),
        sessionId: sid,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const aiMsg = await apiSendMessage(sid, content, fileIds);
        setMessages((prev) => [...prev, aiMsg]);
        // обновить заголовок сессии если первое сообщение
        if (messages.length === 0) {
          const title = content.slice(0, 40) + (content.length > 40 ? "…" : "");
          await apiUpdateSessionTitle(sid, title);
          setSessions((prev) =>
            prev.map((s) => (s.id === sid ? { ...s, title } : s))
          );
        }
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : "Ошибка сети";
        const failMsg: ChatMessage = {
          id: "local_err_" + Date.now(),
          sessionId: sid,
          role: "assistant",
          content: "❌ " + errMsg,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, failMsg]);
      } finally {
        setLoading(false);
      }
    },
    [currentSessionId, createSession, messages.length]
  );

  return {
    sessions,
    currentSessionId,
    messages,
    loading,
    loadSessions,
    createSession,
    selectSession,
    deleteSession,
    sendMessage,
  };
}
