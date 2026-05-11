export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface Session {
  id: string;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCall?: ToolCall;
  fileRef?: string;
  createdAt: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface DataFile {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  rowCount: number;
  columns: DataColumn[];
  createdAt: string;
}

export interface DataColumn {
  name: string;
  type: "string" | "number" | "date" | "boolean";
  sample: unknown;
}

export interface DataRow {
  [key: string]: unknown;
}

export interface ReportStructure {
  sheets: ReportSheet[];
}

export interface ReportSheet {
  name: string;
  tables: ReportTable[];
  charts: ReportChart[];
}

export interface ReportTable {
  headers: string[];
  rows: (string | number)[][];
}

export interface ReportChart {
  type: "bar" | "line" | "pie";
  title: string;
  labels: string[];
  datasets: { label: string; data: number[] }[];
}

export interface GeneratedReport {
  id: string;
  messageId: string;
  filename: string;
  fileUrl: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  message: string;
  status?: number;
}
