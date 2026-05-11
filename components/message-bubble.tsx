"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatTime, cn } from "@/lib/utils";
import { type ChatMessage } from "@/lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex gap-2.5 max-w-[860px] w-full mx-auto", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold shrink-0 self-end mb-5",
          isUser ? "bg-dm-accent text-dm-text" : "bg-dm-sidebar border border-dm-border text-dm-text"
        )}
      >
        {isUser ? "Вы" : "AI"}
      </div>
      <div className={cn("flex flex-col min-w-0", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed max-w-full",
            isUser
              ? "bg-dm-accent text-dm-text rounded-br-sm"
              : "bg-dm-sidebar border border-dm-border text-dm-text rounded-bl-sm"
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        <div className={cn("flex items-center gap-1 mt-1", isUser ? "flex-row-reverse" : "flex-row")}>
          <span className="text-[11px] text-dm-text-muted/60">{formatTime(message.createdAt)}</span>
          {!isUser && (
            <button
              onClick={handleCopy}
              title="Скопировать"
              className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-dm-text-muted hover:text-dm-text p-1 rounded transition-all"
            >
              {copied ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
