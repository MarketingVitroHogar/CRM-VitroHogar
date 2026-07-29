"use client";

import { useEffect, useState } from "react";
import type { Role } from "@prisma/client";
import { MonthPicker } from "./MonthPicker";
import { MetricCard } from "./MetricCard";
import { CanalBreakdownTable, type CanalRow } from "./CanalBreakdownTable";
import { SucursalBreakdownTable, type SucursalRow } from "./SucursalBreakdownTable";

type ReportData = {
  months: string[];
  metrics: {
    totalLeads: number;
    leadsEnProceso: number;
    cotizaciones: number;
    ventas: number;
    totalVendido: number;
    tasaConversion: number;
    sinSeguimientoATiempo: number;
  };
  porCanal: CanalRow[];
  porSucursal: SucursalRow[];
};

export function ReportsView({ role }: { role: Role }) {
  const [month, setMonth] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function fetchReport() {
      setLoading(true);
      const params = new URLSearchParams();
      if (month) params.set("mes", month);
      const res = await fetch(`/api/reports?${params.toString()}`);
      if (res.ok) {
        const body = await res.json();
        if (!ignore) setData(body);
      }
      if (!ignore) setLoading(false);
    }

    fetchReport();
    return () => {
      ignore = true;
    };
  }, [month]);

  if (loading && !data) {
    return <p className="text-sm text-slate-500">Cargando…</p>;
  }
  if (!data) {
    return <p className="text-sm text-red-600">No se pudo cargar el reporte.</p>;
  }

  const { metrics } = data;

  return (
    <div className="flex flex-col gap-6">
      <MonthPicker months={data.months} value={month} onChange={setMonth} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <MetricCard label="Leads totales" value={String(metrics.totalLeads)} hint="por fecha de ingreso" />
        <MetricCard label="Leads en proceso" value={String(metrics.leadsEnProceso)} />
        <MetricCard label="Cotizaciones" value={String(metrics.cotizaciones)} />
        <MetricCard label="Ventas" value={String(metrics.ventas)} hint="por fecha de cierre" />
        <MetricCard
          label="Total vendido"
          value={`$${metrics.totalVendido.toLocaleString("es-MX")}`}
          hint="por fecha de cierre"
        />
        <MetricCard label="Tasa de conversión" value={`${metrics.tasaConversion}%`} />
        <MetricCard label="Sin seguimiento a tiempo" value={String(metrics.sinSeguimientoATiempo)} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Leads por canal</h2>
        <CanalBreakdownTable rows={data.porCanal} />
      </div>

      {role === "coord" && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Leads por sucursal</h2>
          <SucursalBreakdownTable rows={data.porSucursal} />
        </div>
      )}
    </div>
  );
}
