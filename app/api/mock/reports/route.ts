import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Нет токена" }, { status: 401 });
  await new Promise((r) => setTimeout(r, 2000));
  const report = { id: "rep_" + Date.now(), messageId: "msg_" + Date.now(), filename: "report_" + Date.now() + ".xlsx", fileUrl: "#", createdAt: new Date().toISOString() };
  return NextResponse.json(report);
}
