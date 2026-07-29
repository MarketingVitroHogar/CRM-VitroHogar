import type { Lead, Sucursal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isOverdue, round2 } from "@/lib/leadPolicy";
import { FUENTES, SUCURSALES } from "@/lib/catalogs";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split("-").map(Number);
  return { start: new Date(year, mon - 1, 1), end: new Date(year, mon, 1) };
}

export async function getAvailableMonths(scopeSucursal?: Sucursal | null): Promise<string[]> {
  const where = scopeSucursal ? { sucursal: scopeSucursal } : {};
  const leads = await prisma.lead.findMany({
    where,
    select: { fecha: true, fechaCierre: true },
  });

  const months = new Set<string>();
  for (const lead of leads) {
    months.add(monthKey(lead.fecha));
    if (lead.fechaCierre) months.add(monthKey(lead.fechaCierre));
  }
  return [...months].sort().reverse();
}

function sumMonto(rows: Lead[]): number {
  return round2(rows.reduce((sum, r) => sum + (r.montoVenta != null ? Number(r.montoVenta) : 0), 0));
}

function conversionRate(ventas: number, perdidos: number): number {
  const denom = ventas + perdidos;
  return denom === 0 ? 0 : round2((ventas / denom) * 100);
}

export async function getMonthlyReport(month: string | null, scopeSucursal?: Sucursal | null) {
  const baseWhere = scopeSucursal ? { sucursal: scopeSucursal } : {};

  let ingresados: Lead[];
  let cerrados: Lead[];

  if (month) {
    const { start, end } = monthRange(month);
    [ingresados, cerrados] = await Promise.all([
      prisma.lead.findMany({ where: { ...baseWhere, fecha: { gte: start, lt: end } } }),
      prisma.lead.findMany({ where: { ...baseWhere, fechaCierre: { gte: start, lt: end } } }),
    ]);
  } else {
    const all = await prisma.lead.findMany({ where: baseWhere });
    ingresados = all;
    cerrados = all.filter((l) => l.fechaCierre != null);
  }

  const now = new Date();
  const ventasCerradas = cerrados.filter((l) => l.estado === "VENTA");
  const perdidosCerrados = cerrados.filter((l) => l.estado === "PERDIDO");

  const metrics = {
    totalLeads: ingresados.length,
    leadsEnProceso: ingresados.filter((l) => l.estado !== "VENTA" && l.estado !== "PERDIDO").length,
    cotizaciones: ingresados.filter((l) => l.estado === "COTIZACION").length,
    ventas: ventasCerradas.length,
    totalVendido: sumMonto(ventasCerradas),
    tasaConversion: conversionRate(ventasCerradas.length, perdidosCerrados.length),
    sinSeguimientoATiempo: ingresados.filter((l) => isOverdue(l, now)).length,
  };

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
    .filter((row) => row.total > 0 || row.ventas > 0)
    .sort((a, b) => b.total - a.total);

  const porSucursal = scopeSucursal
    ? []
    : SUCURSALES.map((sucursal) => {
        const ingresadosSucursal = ingresados.filter((l) => l.sucursal === sucursal);
        const ventasSucursal = ventasCerradas.filter((l) => l.sucursal === sucursal);
        const perdidosSucursal = perdidosCerrados.filter((l) => l.sucursal === sucursal);
        return {
          sucursal,
          total: ingresadosSucursal.length,
          ventas: ventasSucursal.length,
          tasaConversion: conversionRate(ventasSucursal.length, perdidosSucursal.length),
        };
      }).filter((row) => row.total > 0 || row.ventas > 0);

  return { metrics, porCanal, porSucursal };
}
