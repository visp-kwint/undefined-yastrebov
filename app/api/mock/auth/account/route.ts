import { NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Нет токена" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
