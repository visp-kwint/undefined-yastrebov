export interface FileAttachment {
  name: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  isHtml: boolean;
  time: Date;
  attachments?: FileAttachment[];
}

export interface ChatSession {
  id: string;
  dbId: string | null;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastActivity: Date;
}

export interface HistoryItem {
  id: string;
  dbId: string | null;
  title: string;
  time: Date;
}

export interface ApiResult {
  ok: boolean;
  status: number;
  data: any;
}