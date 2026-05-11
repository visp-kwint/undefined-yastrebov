"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
}

export function AuthModal({ open, onClose, onLogin, onRegister }: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Заполните все поля"); return; }
    if (tab === "register") {
      if (password.length < 4) { setError("Пароль минимум 4 символа"); return; }
      if (password !== password2) { setError("Пароли не совпадают"); return; }
    }
    setLoading(true);
    try {
      if (tab === "login") await onLogin(email, password);
      else await onRegister(email, password);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-dm-sidebar rounded-2xl p-7 w-full max-w-[420px] shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-dm-text-muted hover:text-dm-text text-2xl w-9 h-9 flex items-center justify-center rounded-full hover:bg-dm-surface transition-colors">
          ×
        </button>

        <div className="flex border-b border-dm-border mb-6">
          <button
            onClick={() => { setTab("login"); setError(""); }}
            className={cn("flex-1 pb-3 text-sm transition-colors border-b-2", tab === "login" ? "text-dm-text border-dm-text" : "text-dm-text-muted border-transparent hover:text-dm-text-secondary")}
          >
            Вход
          </button>
          <button
            onClick={() => { setTab("register"); setError(""); }}
            className={cn("flex-1 pb-3 text-sm transition-colors border-b-2", tab === "register" ? "text-dm-text border-dm-text" : "text-dm-text-muted border-transparent hover:text-dm-text-secondary")}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-dm-bg border border-dm-border rounded-xl px-4 py-3.5 text-dm-text placeholder:text-dm-text-muted outline-none focus:border-dm-text-muted transition-colors"
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-dm-bg border border-dm-border rounded-xl px-4 py-3.5 text-dm-text placeholder:text-dm-text-muted outline-none focus:border-dm-text-muted transition-colors"
          />
          {tab === "register" && (
            <>
              <input
                type="password"
                placeholder="Повторите пароль"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="w-full bg-dm-bg border border-dm-border rounded-xl px-4 py-3.5 text-dm-text placeholder:text-dm-text-muted outline-none focus:border-dm-text-muted transition-colors"
              />
              <p className="text-xs text-dm-text-muted -mt-2 pl-1">Минимум 4 символа</p>
            </>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-dm-btn text-dm-bg font-medium py-3.5 rounded-xl hover:bg-dm-btn-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-dm-bg/30 border-t-dm-bg rounded-full animate-spin" />}
            {tab === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>
      </div>
    </div>
  );
}
