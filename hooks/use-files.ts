"use client";

import { useState, useCallback } from "react";
import { type DataFile } from "@/lib/types";
import { apiUploadFile, apiLoadFiles, apiGetFileData } from "@/lib/api";

export function useFiles() {
  const [files, setFiles] = useState<DataFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ rows: Record<string, unknown>[]; columns: string[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadFiles = useCallback(async () => {
    const list = await apiLoadFiles();
    setFiles(list);
  }, []);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const dataFile = await apiUploadFile(file);
      setFiles((prev) => [dataFile, ...prev]);
      setActiveFileId(dataFile.id);
      return dataFile;
    } finally {
      setUploading(false);
    }
  }, []);

  const selectFile = useCallback(async (id: string) => {
    setActiveFileId(id);
    setLoadingPreview(true);
    try {
      const data = await apiGetFileData(id);
      setPreviewData(data);
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  return {
    files,
    activeFileId,
    previewData,
    uploading,
    loadingPreview,
    loadFiles,
    upload,
    selectFile,
  };
}
