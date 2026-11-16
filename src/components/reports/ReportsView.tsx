"use client";

import { useEffect, useState } from "react";
import type { Estado, Role, Sucursal } from "@prisma/client";
import { PeriodoFilter } from "@/components/ui/PeriodoFilter";
import { PERIODO_POR_DEFECTO, rangoDe, textoRango, type PeriodoState } from "@/lib/periodos";
import { ESTADO_LABELS, SUCURSAL_LABELS } from "@/lib/catalogs";
import { MetricCard } from "./MetricCard";
import { CanalBreakdownTable, type CanalRow } from "./CanalBreakdownTable";
import { SucursalBreakdownTable, type SucursalRow } from "./SucursalBreakdownTable";
import { TendenciaChart } from "@/components/charts/TendenciaChart";
import { BarrasH } from "@/components/charts/BarrasH";

type Metrics = {
  totalLeads: number;
  leadsEnProceso: number;
  cotizaciones: number;
  ventas: number;
  totalVendido: number;
  ticketPromedio: number;
  tasaConversion: number;
  sinSeguimientoATiempo: number;
};

type ReportData = {
  metrics: Metrics;
  comparativo: { desde: string; hasta: string; metrics: Metrics } | null;
  porCanal: CanalRow[];
  porSucursal: SucursalRow[];
  porAsesor: { asesor: string; sucursal: Sucursal; leads: number; ventas: number; monto: number; conversion: number }[];
  embudo: { estado: Estado; total: number }[];
  tendencia: { granularidad: "dia" | "semana" | "mes"; puntos: { key: string; label: string; leads: number; ventas: number; monto: number }[] };
};

const ESTADO_COLOR: Record<Estado, string> = {
  NUEVO: "bg-slate-400",
  CONTACTADO: "bg-blue-500",
  COTIZACION: "bg-amber-500",
  SEGUIMIENTO: "bg-purple-500",
  NO_RESPONDIO: "bg-orange-500",
  VENTA: "bg-green-500",
  PERDIDO: "bg-red-500",
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");

function Skeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy="true" aria-label="Cargando reporte">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-slate-200/70" />
        ))}
      </div>
      <div className="h-56 rounded-lg bg-slate-200/70" />
    </div>
  );
}

export function ReportsView({ role }: { role: Role }) {
  const [periodo, setPeriodo] = useState<PeriodoState>(PERIODO_POR_DEFECTO);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const range = rangoDe(periodo); // se calcula al pedir: "Hoy" siempre es el día actual
  const exportQs = range ? `?from=${range.from}&to=${range.to}` : "";

  useEffect(() => {
    let ignore = false;

    async function fetchReport() {
      setLoading(true);
      setError(false);
      const params = new URLSearchParams();
      const r = rangoDe(periodo);
      if (r) {
        params.set("from", r.from);
        params.set("to", r.to);
      }
      try {
        const res = await fetch(`/api/reports?${params.toString()}`);
        if (!res.ok) throw new Error();
        const body = await res.json();
        if (!ignore) setData(body);
      } catch {
        if (!ignore) setError(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchReport();
    return () => {
      ignore = true;
    };
  }, [periodo]);

  const m = data?.metrics;
  const c = data?.comparativo?.metrics;
  const d = (k: keyof Metrics, extra?: { menosEsMejor?: boolean; puntos?: boolean }) => (m && c ? { actual: m[k], anterior: c[k], ...extra } : null);

  return (
    <div className="flex flex-col gap-6">
      {/* Solo al imprimir: título con el periodo */}
      <div className="hidden print:block">
        <h1 className="text-lg font-semibold text-slate-900">Reporte CRM Vitro Hogar</h1>
        <p className="text-sm text-slate-600">
          Periodo: {textoRango(range)} · {role === "coord" ? "Todas las sucursales" : "Mi sucursal"}
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <PeriodoFilter value={periodo} onChange={setPeriodo} />
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/reports/export${exportQs}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span aria-hidden>⬇</span> Exportar a Excel
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span aria-hidden>🖨</span> Imprimir / PDF
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">No se pudo cargar el reporte. Intenta de nuevo.</p>}
      {loading && !data && <Skeleton />}

      {data && m && (
        <div className={loading ? "flex flex-col gap-6 opacity-60 transition" : "flex flex-col gap-6 transition"}>
          {data.comparativo && (
            <p className="-mt-3 text-xs text-slate-500">
              Comparado con el periodo anterior ({data.comparativo.desde} a {data.comparativo.hasta}).
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <MetricCard label="Leads totales" value={String(m.totalLeads)} hint="por fecha de ingreso" delta={d("totalLeads")} />
            <MetricCard label="Leads en proceso" value={String(m.leadsEnProceso)} delta={d("leadsEnProceso")} />
            <MetricCard label="Cotizaciones" value={String(m.cotizaciones)} delta={d("cotizaciones")} />
            <MetricCard label="Ventas" value={String(m.ventas)} hint="por fecha de cierre" delta={d("ventas")} />
            <MetricCard label="Total vendido" value={money(m.totalVendido)} hint="por fecha de cierre" delta={d("totalVendido")} />
            <MetricCard label="Tasa de conversión" value={`${m.tasaConversion}%`} delta={d("tasaConversion", { puntos: true })} />
            <MetricCard label="Sin seguimiento a tiempo" value={String(m.sinSeguimientoATiempo)} delta={d("sinSeguimientoATiempo", { menosEsMejor: true })} />
            <MetricCard label="Ticket promedio" value={money(m.ticketPromedio)} hint="total vendido ÷ ventas" delta={d("ticketPromedio")} />
          </div>

          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Leads y ventas {data.tendencia.granularidad === "dia" ? "por día" : data.tendencia.granularidad === "semana" ? "por semana" : "por mes"}
            </h2>
            <TendenciaChart puntos={data.tendencia.puntos} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Embudo: leads por estado</h2>
              <BarrasH filas={data.embudo.map((e) => ({ label: ESTADO_LABELS[e.estado], valor: e.total, colorClase: ESTADO_COLOR[e.estado] }))} />
            </section>
            <section className="min-w-0">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Leads por canal</h2>
              <CanalBreakdownTable rows={data.porCanal} />
            </section>
          </div>

          {role === "coord" && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Leads por sucursal</h2>
              <SucursalBreakdownTable rows={data.porSucursal} />
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Desempeño por asesor</h2>
            {data.porAsesor.length === 0 ? (
              <p className="text-sm text-slate-400">Sin datos para este periodo.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-slate-500">Asesor</th>
                      {role === "coord" && <th className="px-4 py-2 text-left font-medium text-slate-500">Sucursal</th>}
                      <th className="px-4 py-2 text-right font-medium text-slate-500">Leads</th>
                      <th className="px-4 py-2 text-right font-medium text-slate-500">Ventas</th>
                      <th className="px-4 py-2 text-right font-medium text-slate-500">Monto vendido</th>
                      <th className="px-4 py-2 text-right font-medium text-slate-500">Conversión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.porAsesor.map((a) => (
                      <tr key={`${a.asesor}-${a.sucursal}`} className={a.asesor === "Sin asignar" ? "text-slate-400" : undefined}>
                        <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-800">{a.asesor}</td>
                        {role === "coord" && <td className="whitespace-nowrap px-4 py-2 text-slate-600">{SUCURSAL_LABELS[a.sucursal]}</td>}
                        <td className="px-4 py-2 text-right">{a.leads}</td>
                        <td className="px-4 py-2 text-right font-semibold">{a.ventas}</td>
                        <td className="px-4 py-2 text-right">{money(a.monto)}</td>
                        <td className="px-4 py-2 text-right">{a.conversion}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-1 text-xs text-slate-400">Conversión = ventas ÷ (ventas + perdidos) cerrados en el periodo.</p>
          </div>
        </div>
      )}
    </div>
  );
}
