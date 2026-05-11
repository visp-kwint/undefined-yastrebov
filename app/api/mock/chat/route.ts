import { NextRequest, NextResponse } from "next/server";

const responses = [
  "На основе загруженного датасета:\n\n- Средняя выручка: **1.33M**\n- Медиана: **1.3M**\n- Рост MoM: **+8.3%**",
  "Построил сводную таблицу. Ключевые метрики:\n- SUM: 4.0M\n- AVG: 1.33M\n- MAX: 1.5M (февраль)",
  "Корреляция между колонками **Выручка** и **Прибыль** составляет **0.87** — сильная положительная связь.",
];

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Нет токена" }, { status: 401 });
  const body = await req.json();
  await new Promise((r) => setTimeout(r, 1200));
  const text = responses[Math.floor(Math.random() * responses.length)];
  const msg = { id: "m_" + Date.now(), sessionId: body.sessionId, role: "assistant", content: text, createdAt: new Date().toISOString() };
  return NextResponse.json(msg);
}
