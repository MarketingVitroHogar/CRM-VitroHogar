import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getReport } from "@/lib/reportsAggregation";
import { dayRangeUTC } from "@/lib/dateOnly";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const scopeSucursal = session.user.role === "gerente" ? session.user.sucursal : null;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const range = from && to ? dayRangeUTC(from, to) : null;

  const report = await getReport(range, scopeSucursal);

  return NextResponse.json(report);
}
