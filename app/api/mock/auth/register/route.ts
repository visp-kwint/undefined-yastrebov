import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body;
  if (!email || !password || password.length < 4) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const user = { id: "u_" + Math.random().toString(36).slice(2, 8), email, createdAt: new Date().toISOString() };
  const token = "mock_token_" + user.id;
  return NextResponse.json({ token, user }, { status: 201 });
}
