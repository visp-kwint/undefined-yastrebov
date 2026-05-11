import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Нет токена" }, { status: 401 });
  const body = await req.json();
  return NextResponse.json({ id: "u1", email: "user@example.com", name: body.name, createdAt: new Date().toISOString() });
}
