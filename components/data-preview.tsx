"use client";

import { cn } from "@/lib/utils";

interface DataPreviewProps {
  data: { rows: Record<string, unknown>[]; columns: string[] } | null;
  loading: boolean;
}

export function DataPreview({ data, loading }: DataPreviewProps) {
  if (loading) {
    return (
      <div className="bg-dm-card rounded-xl border border-dm-border p-6 text-center text-dm-text-muted">
        <div className="w-6 h-6 border-2 border-dm-text-muted/30 border-t-dm-text rounded-full animate-spin mx-auto mb-3" />
        Загрузка данных...
      </div>
    );
  }
  if (!data || !data.rows.length) return null;

  const displayRows = data.rows.slice(0, 50);

  return (
    <div className="bg-dm-card rounded-xl border border-dm-border overflow-hidden">
      <div className="px-4 py-3 border-b border-dm-border flex items-center justify-between">
        <span className="text-sm font-medium text-dm-text">Предпросмотр данных</span>
        <span className="text-xs text-dm-text-muted">{data.rows.length} строк · {data.columns.length} колонок</span>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-dm-surface">
              {data.columns.map((col) => (
                <th key={col} className="text-left px-4 py-2.5 text-dm-text-secondary font-medium whitespace-nowrap border-b border-dm-border">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i} className="border-b border-dm-border/50 hover:bg-dm-surface/30 transition-colors">
                {data.columns.map((col) => (
                  <td key={col} className="px-4 py-2 text-dm-text-secondary whitespace-nowrap">
                    {String(row[col] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.rows.length > 50 && (
        <div className="px-4 py-2 text-xs text-dm-text-muted text-center border-t border-dm-border">
          Показано 50 из {data.rows.length} строк
        </div>
      )}
    </div>
  );
}
