import type { Sucursal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mexicoTodayAsUTCDate } from "@/lib/dateOnly";

const DAY = 86_400_000;

export type SeguimientoItem = {
  id: string;
  nombre: string;
  estado: string;
  sucursal: Sucursal;
  asesor: string | null;
  seguimiento: string; // YYYY-MM-DD
  vencido: boolean;
};

/**
 * Seguimientos de hoy o vencidos de leads ya contactados (Contactado, Cotización… no Nuevo: esos ya cuentan como
 * "sin atender"), ingresados este mes. Los usan Inicio y la campana, para que sus números coincidan.
 * `scope`: sucursal del gerente (null = todas, para Coordinación).
 */
export async function getSeguimientos(scope: Sucursal | null, take = 6) {
  const hoy = mexicoTodayAsUTCDate();
  const manana = new Date(hoy.getTime() + DAY);
  const mesInicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const where = {
    ...(scope ? { sucursal: scope } : {}),
    fecha: { gte: mesInicio, lt: manana },
    proximoSeguimiento: { lt: manana },
    estado: { notIn: ["NUEVO", "VENTA", "PERDIDO"] as ("NUEVO" | "VENTA" | "PERDIDO")[] },
  };
  const rows = await prisma.lead.findMany({
    where,
    orderBy: { proximoSeguimiento: "asc" },
    take: 2000,
    select: { id: true, nombre: true, estado: true, sucursal: true, asesor: true, proximoSeguimiento: true },
  });
  const vencido = (d: Date) => d.getTime() < hoy.getTime();
  const porSuc = new Map<Sucursal, { sucursal: Sucursal; total: number; vencidos: number }>();
  for (const r of rows) {
    const e = porSuc.get(r.sucursal) ?? { sucursal: r.sucursal, total: 0, vencidos: 0 };
    e.total++;
    if (vencido(r.proximoSeguimiento!)) e.vencidos++;
    porSuc.set(r.sucursal, e);
  }
  const items: SeguimientoItem[] = rows.slice(0, take).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    estado: r.estado,
    sucursal: r.sucursal,
    asesor: r.asesor,
    seguimiento: r.proximoSeguimiento!.toISOString().slice(0, 10),
    vencido: vencido(r.proximoSeguimiento!),
  }));
  return {
    total: rows.length,
    vencidos: rows.filter((r) => vencido(r.proximoSeguimiento!)).length,
    items,
    porSucursal: [...porSuc.values()].sort((a, b) => b.vencidos - a.vencidos || b.total - a.total),
  };
}
