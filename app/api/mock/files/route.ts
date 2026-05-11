import { NextRequest, NextResponse } from "next/server";

const mockFiles = [
  { id: "f1", filename: "sales_q1.xlsx", originalName: "sales_q1.xlsx", fileSize: 45230, rowCount: 1240, columns: [{ name: "Дата", type: "date", sample: "2024-01-01" }, { name: "Регион", type: "string", sample: "МСК" }, { name: "Сумма", type: "number", sample: 100000 }], createdAt: new Date().toISOString() },
  { id: "f2", filename: "costs_2024.csv", originalName: "costs_2024.csv", fileSize: 12800, rowCount: 560, columns: [{ name: "Месяц", type: "string", sample: "Янв" }, { name: "Статья", type: "string", sample: "Аренда" }, { name: "Расход", type: "number", sample: 50000 }], createdAt: new Date().toISOString() },
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Нет токена" }, { status: 401 });
  return NextResponse.json(mockFiles);
}
