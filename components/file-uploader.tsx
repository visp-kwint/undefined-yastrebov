"use client";

import { useCallback, useState } from "react";
import { cn, formatBytes } from "@/lib/utils";
import { type DataFile } from "@/lib/types";

interface FileUploaderProps {
  onUpload: (file: File) => Promise<DataFile | undefined>;
  uploading: boolean;
}

export function FileUploader({ onUpload, uploading }: FileUploaderProps) {
  const [drag, setDrag] = useState(false);
  const [recent, setRecent] = useState<DataFile | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const file = files[0];
      if (!file.name.match(/\.(xlsx|csv)$/i)) {
        alert("Поддерживаются только .xlsx и .csv");
        return;
      }
      const result = await onUpload(file);
      if (result) setRecent(result);
    },
    [onUpload]
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer); }}
        className={cn(
          "border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer",
          drag ? "border-dm-text bg-dm-surface/50" : "border-dm-border hover:border-dm-text-muted"
        )}
      >
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer block">
          <div className="text-3xl mb-3">📁</div>
          <p className="text-dm-text font-medium mb-1">
            {uploading ? "Загрузка..." : "Перетащите файл или нажмите"}
          </p>
          <p className="text-dm-text-muted text-sm">.xlsx, .csv до 50 МБ</p>
        </label>
      </div>

      {recent && (
        <div className="bg-dm-surface rounded-xl p-4 border border-dm-border">
          <div className="flex items-center gap-3">
            <span className="text-xl">📊</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-dm-text truncate">{recent.originalName}</div>
              <div className="text-xs text-dm-text-muted">
                {recent.rowCount} строк · {recent.columns.length} колонок · {formatBytes(recent.fileSize)}
              </div>
            </div>
            <span className="text-dm-success text-xs font-medium">✓ Загружен</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {recent.columns.map((col) => (
              <span key={col.name} className="text-xs bg-dm-bg px-2.5 py-1 rounded-md text-dm-text-secondary border border-dm-border">
                {col.name} <span className="text-dm-text-muted">({col.type})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
