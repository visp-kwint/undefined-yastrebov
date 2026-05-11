import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Нет токена" }, { status: 401 });
  await new Promise((r) => setTimeout(r, 1500));
  const file = { id: "f_" + Math.random().toString(36).slice(2, 8), filename: "uploaded.xlsx", originalName: "uploaded.xlsx", fileSize: 24000, rowCount: 500, columns: [{ name: "Дата", type: "date", sample: "2024-01-01" }, { name: "Регион", type: "string", sample: "МСК" }, { name: "Сумма", type: "number", sample: 100000 }], createdAt: new Date().toISOString() };
  return NextResponse.json(file, { status: 201 });
}
