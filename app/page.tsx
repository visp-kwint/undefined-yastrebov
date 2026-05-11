"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { AuthModal } from "@/components/auth-modal";
import { ProfileModal } from "@/components/profile-modal";
import { FileUploader } from "@/components/file-uploader";
import { DataPreview } from "@/components/data-preview";
import { ChatInterface } from "@/components/chat-interface";
import { WelcomeScreen } from "@/components/welcome-screen";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import { useFiles } from "@/hooks/use-files";
import { apiUploadFile } from "@/lib/api";
import { cn } from "@/lib/utils";

type View = "welcome" | "chat" | "upload" | "preview";

export default function Home() {
  const { user, login, register, logout, deleteAccount, updateName, changePassword, isAuth } = useAuth();
  const chat = useChat();
  const files = useFiles();

  const [view, setView] = useState<View>("welcome");
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "default" | "success" | "error"; show: boolean }>({ msg: "", type: "default", show: false });

  useEffect(() => {
    chat.loadSessions();
    files.loadFiles();
  }, []);

  const showToast = useCallback((msg: string, type: "default" | "success" | "error" = "default") => {
    setToast({ msg, type, show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  }, []);

  const handleNewChat = useCallback(() => {
    chat.createSession("Новый чат");
    setView("chat");
    setAttachedFiles([]);
  }, [chat]);

  const handleSelectSession = useCallback(
    async (id: string) => {
      await chat.selectSession(id);
      setView("chat");
      setAttachedFiles([]);
    },
    [chat]
  );

  const handleSend = useCallback(
    async (text: string, fileIds?: string[]) => {
      await chat.sendMessage(text, fileIds);
      setAttachedFiles([]);
    },
    [chat]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      const result = await files.upload(file);
      if (result) {
        showToast(`Файл «${result.originalName}» загружен`, "success");
        setView("preview");
      }
      return result;
    },
    [files, showToast]
  );

  const handleSelectFile = useCallback(
    async (id: string) => {
      await files.selectFile(id);
      setView("preview");
    },
    [files]
  );

  const handleAttachFiles = useCallback((newFiles: File[]) => {
    setAttachedFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleRemoveAttached = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUploadAttached = useCallback(async (filesToUpload: File[]): Promise<string[]> => {
    const ids: string[] = [];
    for (const file of filesToUpload) {
      try {
        const result = await apiUploadFile(file);
        ids.push(result.id);
      } catch (e: unknown) {
        showToast(`Не удалось загрузить «${file.name}»`, "error");
      }
    }
    return ids;
  }, [showToast]);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      await login(email, password);
      showToast("Добро пожаловать!", "success");
    },
    [login, showToast]
  );

  const handleRegister = useCallback(
    async (email: string, password: string) => {
      await register(email, password);
      showToast("Аккаунт создан!", "success");
    },
    [register, showToast]
  );

  const activeFileIds = files.activeFileId ? [files.activeFileId] : undefined;

  return (
    <div className="flex h-screen bg-dm-bg">
      <Sidebar
        sessions={chat.sessions}
        files={files.files}
        currentSessionId={chat.currentSessionId}
        activeFileId={files.activeFileId}
        userEmail={user?.email}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={chat.deleteSession}
        onSelectFile={handleSelectFile}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        isAuth={isAuth}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="shrink-0 flex items-center justify-end px-6 py-4 gap-3">
          {!isAuth && (
            <button
              onClick={() => setAuthOpen(true)}
              className="bg-dm-btn text-dm-bg px-6 py-2 rounded-full text-sm font-medium hover:bg-dm-btn-hover transition-colors"
            >
              Войти
            </button>
          )}
          {isAuth && (
            <button
              onClick={handleNewChat}
              className="bg-dm-surface text-dm-text px-4 py-2 rounded-xl text-sm hover:bg-dm-surface-hover transition-colors border border-dm-border"
            >
              + Новый чат
            </button>
          )}
        </header>

        <div className="flex-1 overflow-hidden">
          {view === "welcome" && <WelcomeScreen onStart={() => setView("upload")} />}

          {view === "chat" && (
            <ChatInterface
              messages={chat.messages}
              loading={chat.loading}
              onSend={handleSend}
              activeFileIds={activeFileIds}
              attachedFiles={attachedFiles}
              onAttachFiles={handleAttachFiles}
              onRemoveAttached={handleRemoveAttached}
              onUploadFiles={handleUploadAttached}
            />
          )}

          {view === "upload" && (
            <div className="h-full overflow-y-auto scrollbar-thin p-6 md:p-10">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl text-dm-text mb-2">Загрузка данных</h2>
                <p className="text-dm-text-secondary mb-6">Загрузите Excel (.xlsx) или CSV файл для анализа</p>
                <FileUploader onUpload={handleUpload} uploading={files.uploading} />
              </div>
            </div>
          )}

          {view === "preview" && (
            <div className="h-full overflow-y-auto scrollbar-thin p-6 md:p-10">
              <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl text-dm-text">Данные файла</h2>
                    <p className="text-dm-text-secondary text-sm mt-1">
                      {files.files.find((f) => f.id === files.activeFileId)?.originalName}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setView("upload")}
                      className="px-4 py-2 bg-dm-surface text-dm-text-secondary rounded-xl text-sm hover:bg-dm-surface-hover transition-colors border border-dm-border"
                    >
                      Загрузить другой
                    </button>
                    <button
                      onClick={() => {
                        handleNewChat();
                        showToast("Файл прикреплён к чату", "success");
                      }}
                      className="px-4 py-2 bg-dm-btn text-dm-bg rounded-xl text-sm font-medium hover:bg-dm-btn-hover transition-colors"
                    >
                      Анализировать
                    </button>
                  </div>
                </div>
                <DataPreview data={files.previewData} loading={files.loadingPreview} />
              </div>
            </div>
          )}
        </div>
      </main>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onLogin={handleLogin} onRegister={handleRegister} />

      <ProfileModal
        open={profileOpen}
        user={user}
        onClose={() => setProfileOpen(false)}
        onLogout={() => { logout(); showToast("Вы вышли из аккаунта"); setProfileOpen(false); }}
        onDeleteAccount={async () => {
          await deleteAccount();
          showToast("Аккаунт удалён", "success");
          setProfileOpen(false);
        }}
        onUpdateName={async (name) => {
          await updateName(name);
          showToast("Имя обновлено", "success");
        }}
        onChangePassword={async (oldP, newP) => {
          await changePassword(oldP, newP);
          showToast("Пароль изменён", "success");
        }}
      />

      {/* Toast */}
      <div
        className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl text-sm shadow-xl z-[9999] transition-all duration-300 max-w-[90vw] text-center",
          toast.show ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0 pointer-events-none",
          toast.type === "success" && "bg-green-900/80 border border-green-500/40 text-green-400",
          toast.type === "error" && "bg-red-900/80 border border-red-500/40 text-red-400",
          toast.type === "default" && "bg-dm-surface border border-dm-border text-dm-text"
        )}
      >
        {toast.msg}
      </div>
    </div>
  );
}
