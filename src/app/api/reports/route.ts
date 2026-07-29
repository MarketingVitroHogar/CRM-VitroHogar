import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAvailableMonths, getMonthlyReport } from "@/lib/reportsAggregation";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const scopeSucursal = session.user.role === "gerente" ? session.user.sucursal : null;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("mes");

  const [months, report] = await Promise.all([
    getAvailableMonths(scopeSucursal),
    getMonthlyReport(month, scopeSucursal),
  ]);

  return NextResponse.json({ months, ...report });
}
