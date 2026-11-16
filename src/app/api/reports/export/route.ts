import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getReport } from "@/lib/reportsAggregation";
import { dayRangeUTC, mexicoTodayAsUTCDate } from "@/lib/dateOnly";
import { reportToXlsx, XLSX_MIME } from "@/lib/excelExport";
import { isDateStr, textoRango } from "@/lib/periodos";
import { SUCURSAL_LABELS } from "@/lib/catalogs";

// Exporta a Excel el reporte del periodo (el gerente solo recibe los datos de su sucursal).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  if ((from && !isDateStr(from)) || (to && !isDateStr(to)) || !!from !== !!to) {
    return NextResponse.json({ error: "Periodo inválido" }, { status: 400 });
  }

  const scope = session.user.role === "gerente" ? session.user.sucursal : null;
  const report = await getReport(from && to ? dayRangeUTC(from, to) : null, scope);
  const hoy = mexicoTodayAsUTCDate().toISOString().slice(0, 10);
  const buf = reportToXlsx(report, textoRango(from && to ? { from, to } : null), scope ? `Sucursal ${SUCURSAL_LABELS[scope]}` : "Todas las sucursales");

  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": XLSX_MIME, "Content-Disposition": `attachment; filename="reporte-${hoy}.xlsx"`, "Cache-Control": "no-store" },
  });
}
