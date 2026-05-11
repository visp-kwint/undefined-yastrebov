import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Нет токена" }, { status: 401 });
  return NextResponse.json({ user: { id: "u1", email: "user@example.com", createdAt: new Date().toISOString() } });
}
