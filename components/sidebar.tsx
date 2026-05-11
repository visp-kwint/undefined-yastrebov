"use client";

import { useState, useEffect } from "react";
import { cn, truncate } from "@/lib/utils";
import { type Session, type DataFile } from "@/lib/types";

interface SidebarProps {
  sessions: Session[];
  files: DataFile[];
  currentSessionId: string | null;
  activeFileId: string | null;
  userEmail?: string;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onSelectFile: (id: string) => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  isAuth: boolean;
}

export function Sidebar({
  sessions,
  files,
  currentSessionId,
  activeFileId,
  userEmail,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onSelectFile,
  onOpenAuth,
  onOpenProfile,
  isAuth,
}: SidebarProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chats" | "files">("chats");

  useEffect(() => {
    const handle = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const grouped = {
    today: sessions.filter((s) => new Date(s.updatedAt || s.createdAt) >= today),
    week: sessions.filter((s) => {
      const d = new Date(s.updatedAt || s.createdAt);
      return d < today && d >= weekAgo;
    }),
    older: sessions.filter((s) => new Date(s.updatedAt || s.createdAt) < weekAgo),
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/60 z-[199] backdrop-blur-sm transition-opacity md:hidden",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
      />

      <aside
        className={cn(
          "fixed md:relative top-0 left-0 bottom-0 w-[280px] md:w-[260px] lg:w-[280px] xl:w-[300px]",
          "bg-dm-sidebar border-r border-dm-border flex flex-col z-[200] transition-transform duration-300",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-6">
          <h1 className="text-2xl font-normal text-dm-text tracking-wide">DataAnalyst</h1>
          <svg width="28" height="20" viewBox="0 0 33 23" fill="none">
            <rect width="20.0367" height="7.66536" rx="2" fill="#B3B3B3" />
            <rect y="1.70341" width="32.6915" height="20.4409" rx="5" fill="#D9D9D9" />
          </svg>
        </div>

        <div className="flex border-b border-dm-border mx-4 mb-3">
          <button
            onClick={() => setTab("chats")}
            className={cn(
              "flex-1 pb-2 text-sm transition-colors border-b-2",
              tab === "chats" ? "text-dm-text border-dm-text" : "text-dm-text-muted border-transparent hover:text-dm-text-secondary"
            )}
          >
            Чаты
          </button>
          <button
            onClick={() => setTab("files")}
            className={cn(
              "flex-1 pb-2 text-sm transition-colors border-b-2",
              tab === "files" ? "text-dm-text border-dm-text" : "text-dm-text-muted border-transparent hover:text-dm-text-secondary"
            )}
          >
            Файлы
          </button>
        </div>

        <nav className="px-4 mb-4">
          <button
            onClick={() => { onNewChat(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-dm-text-secondary hover:text-dm-text hover:bg-dm-surface transition-colors text-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Новый чат
          </button>
        </nav>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4">
          {tab === "chats" ? (
            <>
              <HistorySection title="Сегодня" items={grouped.today} currentId={currentSessionId} onSelect={onSelectSession} onDelete={onDeleteSession} />
              <HistorySection title="Последние 7 дней" items={grouped.week} currentId={currentSessionId} onSelect={onSelectSession} onDelete={onDeleteSession} />
              <HistorySection title="Ранее" items={grouped.older} currentId={currentSessionId} onSelect={onSelectSession} onDelete={onDeleteSession} />
            </>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  onClick={() => { onSelectFile(file.id); setOpen(false); }}
                  className={cn(
                    "p-3 rounded-lg cursor-pointer text-sm transition-colors",
                    activeFileId === file.id ? "bg-dm-surface text-dm-text" : "text-dm-text-secondary hover:bg-dm-surface hover:text-dm-text"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>📊</span>
                    <span className="truncate">{truncate(file.originalName, 22)}</span>
                  </div>
                  <div className="text-xs text-dm-text-muted mt-1 pl-6">
                    {file.rowCount} строк · {file.columns.length} колонок
                  </div>
                </div>
              ))}
              {files.length === 0 && (
                <div className="text-dm-text-muted text-sm text-center py-8">Нет загруженных файлов</div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-dm-border p-4 space-y-3">
          {isAuth && userEmail ? (
            <button
              onClick={() => { onOpenProfile(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 bg-dm-surface rounded-lg hover:bg-dm-surface-hover transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-dm-bg flex items-center justify-center text-xs">👤</div>
              <span className="text-sm text-dm-text truncate flex-1 text-left">{userEmail}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-dm-text-muted">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="w-full py-2 bg-dm-btn text-dm-bg rounded-full text-sm font-medium hover:bg-dm-btn-hover transition-colors"
            >
              Войти
            </button>
          )}
          <div className="flex justify-center gap-3 text-xs text-dm-text-muted">
            <a href="#" className="hover:text-dm-text-secondary transition-colors">Terms</a>
            <a href="#" className="hover:text-dm-text-secondary transition-colors">Privacy</a>
          </div>
        </div>
      </aside>

      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-[201] md:hidden bg-dm-surface p-2 rounded-lg text-dm-text"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
    </>
  );
}

function HistorySection({
  title,
  items,
  currentId,
  onSelect,
  onDelete,
}: {
  title: string;
  items: Session[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mb-5">
      <h3 className="text-xs text-dm-text-muted mb-2 font-normal uppercase tracking-wider">{title}</h3>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors",
              currentId === item.id ? "bg-dm-surface text-dm-text" : "text-dm-text-secondary hover:bg-dm-surface hover:text-dm-text"
            )}
          >
            <span className="truncate flex-1" onClick={() => onSelect(item.id)} title={item.title}>
              {truncate(item.title, 24)}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              className="opacity-0 group-hover:opacity-100 text-dm-text-muted hover:text-dm-danger transition-all text-lg leading-none px-1"
              title="Удалить"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
