import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Нет токена" }, { status: 401 });
  const body = await req.json();
  if (body.oldPassword !== "password") {
    return NextResponse.json({ error: "Неверный текущий пароль" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
