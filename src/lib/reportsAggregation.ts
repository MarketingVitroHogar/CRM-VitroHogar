import type { Estado, Lead, Sucursal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isOverdue, round2 } from "@/lib/leadPolicy";
import { ESTADOS, FUENTES, SUCURSALES } from "@/lib/catalogs";

type Range = { start: Date; end: Date } | null;

function sumMonto(rows: Lead[]): number {
  return round2(rows.reduce((sum, r) => sum + (r.montoVenta != null ? Number(r.montoVenta) : 0), 0));
}

function conversionRate(ventas: number, perdidos: number): number {
  const denom = ventas + perdidos;
  return denom === 0 ? 0 : round2((ventas / denom) * 100);
}

async function loadLeads(range: Range, scopeSucursal?: Sucursal | null) {
  const baseWhere = scopeSucursal ? { sucursal: scopeSucursal } : {};
  if (range) {
    const { start, end } = range;
    const [ingresados, cerrados] = await Promise.all([
      prisma.lead.findMany({ where: { ...baseWhere, fecha: { gte: start, lt: end } } }),
      prisma.lead.findMany({ where: { ...baseWhere, fechaCierre: { gte: start, lt: end } } }),
    ]);
    return { ingresados, cerrados };
  }
  const all = await prisma.lead.findMany({ where: baseWhere });
  return { ingresados: all, cerrados: all.filter((l) => l.fechaCierre != null) };
}

function coreMetrics(ingresados: Lead[], cerrados: Lead[]) {
  const now = new Date();
  const ventasCerradas = cerrados.filter((l) => l.estado === "VENTA");
  const perdidosCerrados = cerrados.filter((l) => l.estado === "PERDIDO");
  return {
    ventasCerradas,
    perdidosCerrados,
    metrics: {
      totalLeads: ingresados.length,
      leadsEnProceso: ingresados.filter((l) => l.estado !== "VENTA" && l.estado !== "PERDIDO").length,
      cotizaciones: ingresados.filter((l) => l.estado === "COTIZACION").length,
      ventas: ventasCerradas.length,
      totalVendido: sumMonto(ventasCerradas),
      ticketPromedio: ventasCerradas.length ? round2(sumMonto(ventasCerradas) / ventasCerradas.length) : 0,
      tasaConversion: conversionRate(ventasCerradas.length, perdidosCerrados.length),
      sinSeguimientoATiempo: ingresados.filter((l) => isOverdue(l, now)).length,
    },
  };
}

// ---------- Tendencia (leads y ventas por día / semana / mes) ----------

export type Granularidad = "dia" | "semana" | "mes";
export type PuntoTendencia = { key: string; label: string; leads: number; ventas: number; monto: number };

const DAY = 86_400_000;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const off = (x.getUTCDay() + 6) % 7; // lunes = 0
  return new Date(x.getTime() - off * DAY);
}

function bucketKey(d: Date, g: Granularidad): string {
  if (g === "dia") return isoDay(d);
  if (g === "semana") return isoDay(mondayOf(d));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function bucketLabel(key: string, g: Granularidad): string {
  if (g === "mes") {
    const [y, m] = key.split("-").map(Number);
    return `${MESES[m - 1]} ${String(y).slice(2)}`;
  }
  const [, m, d] = key.split("-").map(Number);
  return g === "semana" ? `Sem ${d} ${MESES[m - 1]}` : `${d} ${MESES[m - 1]}`;
}

function buildTendencia(ingresados: Lead[], ventas: Lead[], range: Range) {
  const fechas = [...ingresados.map((l) => l.fecha), ...ventas.map((l) => l.fechaCierre!)].filter(Boolean) as Date[];
  if (fechas.length === 0 && !range) return { granularidad: "mes" as Granularidad, puntos: [] as PuntoTendencia[] };
  const start = range ? range.start : new Date(Math.min(...fechas.map((d) => d.getTime())));
  const end = range ? new Date(range.end.getTime() - DAY) : new Date(Math.max(...fechas.map((d) => d.getTime()), Date.now()));
  const dias = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY) + 1);
  let g: Granularidad = dias <= 35 ? "dia" : dias <= 200 ? "semana" : "mes";

  const keysFor = (gran: Granularidad) => {
    const keys: string[] = [];
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    while (cursor.getTime() <= end.getTime()) {
      const k = bucketKey(cursor, gran);
      if (keys[keys.length - 1] !== k) keys.push(k);
      cursor.setTime(cursor.getTime() + DAY);
    }
    return keys;
  };
  let keys = keysFor(g);
  if (keys.length > 90) {
    g = "mes";
    keys = keysFor(g);
  }

  const map = new Map<string, PuntoTendencia>(keys.map((k) => [k, { key: k, label: bucketLabel(k, g), leads: 0, ventas: 0, monto: 0 }]));
  for (const l of ingresados) {
    const p = map.get(bucketKey(l.fecha, g));
    if (p) p.leads++;
  }
  for (const l of ventas) {
    const p = map.get(bucketKey(l.fechaCierre!, g));
    if (p) {
      p.ventas++;
      p.monto = round2(p.monto + (l.montoVenta != null ? Number(l.montoVenta) : 0));
    }
  }
  return { granularidad: g, puntos: [...map.values()] };
}

// ---------- Reporte ----------

export async function getReport(range: Range, scopeSucursal?: Sucursal | null) {
  const { ingresados, cerrados } = await loadLeads(range, scopeSucursal);
  const { ventasCerradas, perdidosCerrados, metrics } = coreMetrics(ingresados, cerrados);

  // Periodo anterior de la misma duración (para comparar). Sin comparación en "todo el tiempo".
  let comparativo: { desde: string; hasta: string; metrics: typeof metrics } | null = null;
  if (range) {
    const len = range.end.getTime() - range.start.getTime();
    const prev = { start: new Date(range.start.getTime() - len), end: range.start };
    const prevData = await loadLeads(prev, scopeSucursal);
    comparativo = {
      desde: isoDay(prev.start),
      hasta: isoDay(new Date(prev.end.getTime() - DAY)),
      metrics: coreMetrics(prevData.ingresados, prevData.cerrados).metrics,
    };
  }

  const porCanal = FUENTES.map((fuente) => {
    const ingresadosCanal = ingresados.filter((l) => l.fuente === fuente);
    const ventasCanal = ventasCerradas.filter((l) => l.fuente === fuente);
    return {
      fuente,
      total: ingresadosCanal.length,
      porcentaje: ingresados.length === 0 ? 0 : round2((ingresadosCanal.length / ingresados.length) * 100),
      ventas: ventasCanal.length,
      monto: sumMonto(ventasCanal),
    };
  })
    // Siempre salen TODOS los canales de llegada del CRM (Facebook, Instagram, TikTok, WhatsApp, Sitio web, Referido y Otro),
    // aunque no tengan leads en el periodo. Se ordenan por volumen; con empate, en el orden del catálogo.
    .sort((a, b) => b.total - a.total);

  const porSucursal = scopeSucursal
    ? []
    : SUCURSALES.map((sucursal) => {
        const ingresadosSucursal = ingresados.filter((l) => l.sucursal === sucursal);
        const ventasSucursal = ventasCerradas.filter((l) => l.sucursal === sucursal);
        return { sucursal, total: ingresadosSucursal.length, ventas: ventasSucursal.length, montoVendido: sumMonto(ventasSucursal) };
      }).filter((row) => row.total > 0 || row.ventas > 0);

  // Desempeño por asesor (el asesor se guarda como texto; sin asignar = "Sin asignar").
  const asesorKey = (l: Lead) => `${l.asesor?.trim() || "Sin asignar"}|${l.sucursal}`;
  const grupos = new Map<string, { asesor: string; sucursal: Sucursal; leads: Lead[]; ventas: Lead[]; perdidos: Lead[] }>();
  const ensure = (l: Lead) => {
    const k = asesorKey(l);
    if (!grupos.has(k)) grupos.set(k, { asesor: l.asesor?.trim() || "Sin asignar", sucursal: l.sucursal, leads: [], ventas: [], perdidos: [] });
    return grupos.get(k)!;
  };
  ingresados.forEach((l) => ensure(l).leads.push(l));
  ventasCerradas.forEach((l) => ensure(l).ventas.push(l));
  perdidosCerrados.forEach((l) => ensure(l).perdidos.push(l));
  const porAsesor = [...grupos.values()]
    .map((g) => ({
      asesor: g.asesor,
      sucursal: g.sucursal,
      leads: g.leads.length,
      ventas: g.ventas.length,
      monto: sumMonto(g.ventas),
      conversion: conversionRate(g.ventas.length, g.perdidos.length),
    }))
    .sort((a, b) => b.monto - a.monto || b.ventas - a.ventas || b.leads - a.leads);

  const embudo = (ESTADOS as Estado[]).map((estado) => ({
    estado,
    total: ingresados.filter((l) => l.estado === estado).length,
  }));

  const tendencia = buildTendencia(ingresados, ventasCerradas, range);

  return { metrics, comparativo, porCanal, porSucursal, porAsesor, embudo, tendencia };
}
