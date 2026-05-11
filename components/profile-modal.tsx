"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { type User } from "@/lib/types";

interface ProfileModalProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  onUpdateName: (name: string) => Promise<void>;
  onChangePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

export function ProfileModal({ open, user, onClose, onLogout, onDeleteAccount, onUpdateName, onChangePassword }: ProfileModalProps) {
  const [name, setName] = useState(user?.name || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setName(user?.name || "");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setSuccess("");
      setDeleteConfirm(false);
    }
  }, [open, user]);

  if (!open || !user) return null;

  const handleSaveName = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await onUpdateName(name);
      setSuccess("Имя обновлено");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setError("");
    setSuccess("");
    if (!oldPassword || !newPassword) { setError("Заполните все поля"); return; }
    if (newPassword.length < 4) { setError("Пароль минимум 4 символа"); return; }
    if (newPassword !== confirmPassword) { setError("Пароли не совпадают"); return; }
    setLoading(true);
    try {
      await onChangePassword(oldPassword, newPassword);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Пароль изменён");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDeleteAccount();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка удаления");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-dm-sidebar rounded-2xl w-full max-w-[400px] shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg text-dm-text font-medium">Профиль</h2>
          <button onClick={onClose} className="text-dm-text-muted hover:text-dm-text text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-dm-surface transition-colors">
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-5">
          {/* Email */}
          <div className="text-center pb-4 border-b border-dm-border">
            <div className="w-16 h-16 rounded-full bg-dm-surface flex items-center justify-center mx-auto mb-3 text-2xl">
              👤
            </div>
            <div className="text-dm-text font-medium break-all">{user.email}</div>
            <div className="text-xs text-dm-text-muted mt-1">ID: {user.id.slice(0, 8)}…</div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-lg px-4 py-2.5">
              {success}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-xs text-dm-text-muted mb-1.5 block">Имя</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                className="flex-1 bg-dm-bg border border-dm-border rounded-xl px-4 py-2.5 text-dm-text placeholder:text-dm-text-muted outline-none focus:border-dm-text-muted transition-colors text-sm"
              />
              <button
                onClick={handleSaveName}
                disabled={loading || !name.trim()}
                className="px-4 py-2.5 bg-dm-btn text-dm-bg rounded-xl text-sm font-medium hover:bg-dm-btn-hover transition-colors disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-3 pt-2 border-t border-dm-border">
            <label className="text-xs text-dm-text-muted block">Смена пароля</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Текущий пароль"
              className="w-full bg-dm-bg border border-dm-border rounded-xl px-4 py-2.5 text-dm-text placeholder:text-dm-text-muted outline-none focus:border-dm-text-muted transition-colors text-sm"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Новый пароль"
              className="w-full bg-dm-bg border border-dm-border rounded-xl px-4 py-2.5 text-dm-text placeholder:text-dm-text-muted outline-none focus:border-dm-text-muted transition-colors text-sm"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите новый пароль"
              className="w-full bg-dm-bg border border-dm-border rounded-xl px-4 py-2.5 text-dm-text placeholder:text-dm-text-muted outline-none focus:border-dm-text-muted transition-colors text-sm"
            />
            <button
              onClick={handleChangePassword}
              disabled={loading}
              className="w-full py-2.5 bg-dm-surface text-dm-text rounded-xl text-sm font-medium hover:bg-dm-surface-hover transition-colors border border-dm-border disabled:opacity-50"
            >
              Изменить пароль
            </button>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-dm-border space-y-2">
            <button
              onClick={() => { onLogout(); onClose(); }}
              className="w-full py-2.5 bg-dm-btn text-dm-bg rounded-xl text-sm font-medium hover:bg-dm-btn-hover transition-colors flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Выйти
            </button>

            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="w-full py-2.5 bg-transparent text-dm-danger rounded-xl text-sm font-medium hover:bg-red-500/10 transition-colors border border-dm-border hover:border-red-500/30"
              >
                Удалить аккаунт
              </button>
            ) : (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-3">
                <p className="text-sm text-red-400 text-center">Вы уверены? Все данные будут удалены навсегда.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="flex-1 py-2 bg-dm-surface text-dm-text rounded-lg text-sm hover:bg-dm-surface-hover transition-colors border border-dm-border"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 py-2 bg-dm-danger text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Удаление…" : "Удалить"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
