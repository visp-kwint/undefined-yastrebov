"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn, formatBytes } from "@/lib/utils";
import { type ChatMessage } from "@/lib/types";
import { MessageBubble } from "./message-bubble";

const MAX_ATTACHMENTS = 5;
const ALLOWED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/vnd.ms-excel",
];

interface ChatInterfaceProps {
  messages: ChatMessage[];
  loading: boolean;
  onSend: (text: string, fileIds?: string[]) => void;
  activeFileIds?: string[];
  attachedFiles: File[];
  onAttachFiles: (files: File[]) => void;
  onRemoveAttached: (index: number) => void;
  onUploadFiles?: (files: File[]) => Promise<string[]>;
}

export function ChatInterface({
  messages,
  loading,
  onSend,
  activeFileIds,
  attachedFiles,
  onAttachFiles,
  onRemoveAttached,
  onUploadFiles,
}: ChatInterfaceProps) {
  const [text, setText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed && !attachedFiles.length) return;

    let fileIds: string[] | undefined = activeFileIds ? [...activeFileIds] : [];

    if (attachedFiles.length && onUploadFiles) {
      const uploadedIds = await onUploadFiles(attachedFiles);
      fileIds = [...fileIds, ...uploadedIds];
    }

    onSend(trimmed || "📎 Прикреплённые файлы", fileIds.length ? fileIds : undefined);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processFiles = useCallback(
    (newFiles: File[]) => {
      const valid = newFiles.filter((f) => {
        const ok = ALLOWED_TYPES.includes(f.type) || f.name.match(/\.(xlsx|csv)$/i);
        if (!ok) alert(`Формат «${f.name}» не поддерживается. Используйте .xlsx или .csv`);
        return ok;
      });

      const unique = valid.filter(
        (f) => !attachedFiles.some((a) => a.name === f.name && a.size === f.size)
      );

      const total = attachedFiles.length + unique.length;
      if (total > MAX_ATTACHMENTS) {
        const allowed = MAX_ATTACHMENTS - attachedFiles.length;
        alert(`Максимум ${MAX_ATTACHMENTS} файлов. Можно добавить ещё ${allowed}.`);
        onAttachFiles(unique.slice(0, allowed));
      } else {
        onAttachFiles(unique);
      }
    },
    [attachedFiles, onAttachFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div
      className="flex flex-col h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-50 bg-dm-accent/20 border-2 border-dashed border-dm-text/40 rounded-xl m-2 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <div className="text-4xl mb-2">📁</div>
            <p className="text-dm-text font-medium">Отпустите файлы для прикрепления</p>
            <p className="text-dm-text-secondary text-sm">.xlsx, .csv до {MAX_ATTACHMENTS} шт.</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="group">
            <MessageBubble message={msg} />
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5 max-w-[860px] w-full mx-auto">
            <div className="w-7 h-7 rounded-lg bg-dm-sidebar border border-dm-border flex items-center justify-center text-[10px] font-semibold shrink-0">AI</div>
            <div className="bg-dm-sidebar border border-dm-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-dm-text-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-dm-text-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-dm-text-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 p-4">
        <div className="max-w-[900px] mx-auto space-y-2">
          {/* Attached files */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map((file, i) => (
                <div
                  key={`${file.name}-${file.size}-${i}`}
                  className="flex items-center gap-2 bg-dm-surface border border-dm-border rounded-lg px-3 py-1.5 text-sm"
                >
                  <span>📎</span>
                  <span className="text-dm-text-secondary truncate max-w-[180px]">{file.name}</span>
                  <span className="text-dm-text-muted text-xs">{formatBytes(file.size)}</span>
                  <button
                    onClick={() => onRemoveAttached(i)}
                    className="text-dm-text-muted hover:text-dm-danger ml-1 transition-colors"
                    title="Удалить"
                  >
                    ×
                  </button>
                </div>
              ))}
              <span className="text-xs text-dm-text-muted self-center">
                {attachedFiles.length}/{MAX_ATTACHMENTS}
              </span>
            </div>
          )}

          <div className="bg-dm-sidebar rounded-2xl p-3 flex items-end gap-2.5 shadow-lg border border-dm-border/50">
            {/* Attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={attachedFiles.length >= MAX_ATTACHMENTS}
              className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-dm-text-muted hover:text-dm-text hover:bg-dm-surface transition-colors disabled:opacity-30"
              title="Прикрепить файл"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={attachedFiles.length ? "Добавьте комментарий или отправьте…" : "Задайте вопрос по данным…"}
              rows={1}
              className="flex-1 bg-transparent text-dm-text placeholder:text-dm-text-muted resize-none outline-none text-base leading-relaxed py-2.5 px-1 max-h-[200px] scrollbar-thin"
            />
            <button
              onClick={handleSubmit}
              disabled={(!text.trim() && !attachedFiles.length) || loading}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all",
                (text.trim() || attachedFiles.length) && !loading
                  ? "bg-dm-text/10 hover:bg-dm-text/20 text-dm-text"
                  : "bg-dm-text/5 text-dm-text-muted cursor-not-allowed"
              )}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
