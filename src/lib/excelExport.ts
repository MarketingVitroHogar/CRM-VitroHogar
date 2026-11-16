import * as XLSX from "xlsx";
import { ESTADO_LABELS, FUENTE_LABELS, SUCURSAL_LABELS } from "@/lib/catalogs";
import type { getReport } from "@/lib/reportsAggregation";

type Report = Awaited<ReturnType<typeof getReport>>;

function sheet(rows: (string | number)[][], widths?: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (widths) ws["!cols"] = widths.map((wch) => ({ wch }));
  return ws;
}

function toBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Excel con el reporte del periodo: resumen, tendencia, canales, sucursales, asesores y embudo. */
export function reportToXlsx(r: Report, periodo: string, alcance: string): Buffer {
  const m = r.metrics;
  const c = r.comparativo?.metrics;
  const wb = XLSX.utils.book_new();

  const resumen: (string | number)[][] = [
    ["Reporte CRM Vitro Hogar"],
    ["Periodo", periodo],
    ["Alcance", alcance],
    [],
    ["Métrica", "Periodo", ...(c ? [`Periodo anterior (${r.comparativo!.desde} a ${r.comparativo!.hasta})`] : [])],
    ["Leads totales", m.totalLeads, ...(c ? [c.totalLeads] : [])],
    ["Leads en proceso", m.leadsEnProceso, ...(c ? [c.leadsEnProceso] : [])],
    ["Cotizaciones", m.cotizaciones, ...(c ? [c.cotizaciones] : [])],
    ["Ventas", m.ventas, ...(c ? [c.ventas] : [])],
    ["Total vendido (MXN)", m.totalVendido, ...(c ? [c.totalVendido] : [])],
    ["Ticket promedio (MXN)", m.ticketPromedio, ...(c ? [c.ticketPromedio] : [])],
    ["Tasa de conversión (%)", m.tasaConversion, ...(c ? [c.tasaConversion] : [])],
    ["Sin seguimiento a tiempo", m.sinSeguimientoATiempo, ...(c ? [c.sinSeguimientoATiempo] : [])],
  ];
  XLSX.utils.book_append_sheet(wb, sheet(resumen, [38, 18, 40]), "Resumen");

  XLSX.utils.book_append_sheet(
    wb,
    sheet([["Periodo", "Leads", "Ventas", "Monto vendido (MXN)"], ...r.tendencia.puntos.map((p) => [p.label, p.leads, p.ventas, p.monto])], [16, 10, 10, 20]),
    `Tendencia (${r.tendencia.granularidad === "dia" ? "por día" : r.tendencia.granularidad === "semana" ? "por semana" : "por mes"})`.slice(0, 31)
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet([["Canal", "Leads", "% del total", "Ventas", "Monto vendido (MXN)"], ...r.porCanal.map((x) => [FUENTE_LABELS[x.fuente], x.total, x.porcentaje, x.ventas, x.monto])], [18, 10, 12, 10, 20]),
    "Por canal"
  );
  if (r.porSucursal.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      sheet([["Sucursal", "Leads", "Ventas", "Monto vendido (MXN)"], ...r.porSucursal.map((x) => [SUCURSAL_LABELS[x.sucursal], x.total, x.ventas, x.montoVendido])], [24, 10, 10, 20]),
      "Por sucursal"
    );
  }
  XLSX.utils.book_append_sheet(
    wb,
    sheet([["Asesor", "Sucursal", "Leads", "Ventas", "Monto vendido (MXN)", "Conversión (%)"], ...r.porAsesor.map((x) => [x.asesor, SUCURSAL_LABELS[x.sucursal], x.leads, x.ventas, x.monto, x.conversion])], [32, 22, 10, 10, 20, 14]),
    "Por asesor"
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet([["Estado", "Leads"], ...r.embudo.map((x) => [ESTADO_LABELS[x.estado], x.total])], [18, 10]),
    "Embudo"
  );
  return toBuffer(wb);
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
