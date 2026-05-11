import { NextRequest, NextResponse } from "next/server";

const mockSessions = [
  { id: "s1", title: "Анализ продаж Q1", userId: "u1", createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date().toISOString() },
  { id: "s2", title: "Финансовый отчёт", userId: "u1", createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Нет токена" }, { status: 401 });
  return NextResponse.json(mockSessions);
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Нет токена" }, { status: 401 });
  const body = await req.json();
  const session = { id: "s_" + Date.now(), title: body.title || "Новый чат", userId: "u1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  return NextResponse.json(session, { status: 201 });
}
