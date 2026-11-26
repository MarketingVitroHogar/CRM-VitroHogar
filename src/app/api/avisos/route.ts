import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiGuards";
import { leadScopeWhere } from "@/lib/permissions";
import { isOverdue } from "@/lib/leadPolicy";
import { mexicoTodayAsUTCDate } from "@/lib/dateOnly";
import { getSeguimientos } from "@/lib/seguimientos";

// Los avisos son SOLO del mes en curso: leads ingresados este mes y ventas cerradas este mes (nada de meses pasados).
function inicioDelMes(): Date {
  const hoy = mexicoTodayAsUTCDate();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
}

const MAX_ITEMS = 15;
const MAX_VENTAS = 10;

/**
 * Avisos de la campana (solo del mes en curso).
 *  - Gerente: lista de los leads "Nuevos" por atender de SU sucursal (el filtro se aplica aquí, en el servidor).
 *  - Coordinación: resumen por sucursal (cuántos leads sin atender) + ventas cerradas recientes.
 * También: seguimientos de hoy o vencidos de leads ya contactados (gerente: los suyos con detalle; Coordinación: por sucursal).
 * "Sin atender" = lead en estado "Nuevo"; "atrasado" usa la regla del CRM (más de 24 h). No guarda nada: se calcula al momento.
 */
export async function GET() {
  const g = await requireSession();
  if (g.error) return g.error;
  const { role, sucursal, asesor } = g.session.user;
  const scope = leadScopeWhere({ id: g.session.user.id, role, sucursal, asesor }); // gerente: su sucursal; asesor: solo sus leads

  const desde = inicioDelMes();
  const rows = await prisma.lead.findMany({
    where: {
      estado: "NUEVO",
      fecha: { gte: desde },
      ...scope,
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: { id: true, nombre: true, telefono: true, interes: true, sucursal: true, fuente: true, asesor: true, createdAt: true, proximoSeguimiento: true, estado: true },
  });

  const now = new Date();
  const withLate = rows.map((r) => ({ ...r, atrasado: isOverdue({ estado: r.estado, proximoSeguimiento: r.proximoSeguimiento, createdAt: r.createdAt }, now) }));
  const atrasados = withLate.filter((r) => r.atrasado).length;

  const seg = await getSeguimientos(role === "coord" ? null : sucursal!, 5, role === "asesor" ? asesor : null);

  if (role !== "coord") {
    return NextResponse.json({
      total: withLate.length,
      atrasados,
      seguimientos: { total: seg.total, vencidos: seg.vencidos, items: seg.items },
      items: withLate.slice(0, MAX_ITEMS).map((r) => ({
        id: r.id,
        nombre: r.nombre,
        telefono: r.telefono,
        interes: r.interes,
        sucursal: r.sucursal,
        fuente: r.fuente,
        asesor: r.asesor,
        createdAt: r.createdAt.toISOString(),
        atrasado: r.atrasado,
      })),
    });
  }

  // ---- Coordinación: resumen por sucursal ----
  const bySuc = new Map<string, { sucursal: string; total: number; atrasados: number }>();
  for (const r of withLate) {
    const e = bySuc.get(r.sucursal) ?? { sucursal: r.sucursal, total: 0, atrasados: 0 };
    e.total++;
    if (r.atrasado) e.atrasados++;
    bySuc.set(r.sucursal, e);
  }
  const porSucursal = [...bySuc.values()].sort((a, b) => b.atrasados - a.atrasados || b.total - a.total);

  // ---- Coordinación: ventas cerradas recientes ----
  const ventasRows = await prisma.lead.findMany({
    where: { estado: "VENTA", fechaCierre: { gte: desde } },
    orderBy: { updatedAt: "desc" },
    take: MAX_VENTAS,
    select: { id: true, nombre: true, sucursal: true, montoVenta: true, folioFactura: true, updatedAt: true },
  });

  return NextResponse.json({
    total: withLate.length,
    atrasados,
    items: [],
    porSucursal,
    seguimientos: { total: seg.total, vencidos: seg.vencidos, porSucursal: seg.porSucursal },
    ventas: ventasRows.map((v) => ({
      id: v.id,
      nombre: v.nombre,
      sucursal: v.sucursal,
      monto: v.montoVenta == null ? null : v.montoVenta.toString(),
      folioFactura: v.folioFactura,
      cerradaAt: v.updatedAt.toISOString(),
    })),
  });
}
