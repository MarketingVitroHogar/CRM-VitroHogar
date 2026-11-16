import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiGuards";
import { isOverdue } from "@/lib/leadPolicy";
import { mexicoTodayAsUTCDate } from "@/lib/dateOnly";

const VENTANA_DIAS = 30; // solo leads ingresados en los últimos 30 días (evita ruido del historial)
const VENTAS_DIAS = 7; // ventas cerradas en los últimos 7 días
const MAX_ITEMS = 15;
const MAX_VENTAS = 10;

/**
 * Avisos de la campana.
 *  - Gerente: lista de los leads "Nuevos" por atender de SU sucursal (el filtro se aplica aquí, en el servidor).
 *  - Coordinación: resumen por sucursal (cuántos leads sin atender) + ventas cerradas recientes.
 * "Sin atender" = lead en estado "Nuevo"; "atrasado" usa la regla del CRM (más de 24 h). No guarda nada: se calcula al momento.
 */
export async function GET() {
  const g = await requireSession();
  if (g.error) return g.error;
  const { role, sucursal } = g.session.user;

  const desde = new Date(mexicoTodayAsUTCDate().getTime() - VENTANA_DIAS * 86_400_000);
  const rows = await prisma.lead.findMany({
    where: {
      estado: "NUEVO",
      fecha: { gte: desde },
      ...(role === "gerente" ? { sucursal: sucursal! } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: { id: true, nombre: true, telefono: true, interes: true, sucursal: true, fuente: true, createdAt: true, proximoSeguimiento: true, estado: true },
  });

  const now = new Date();
  const withLate = rows.map((r) => ({ ...r, atrasado: isOverdue({ estado: r.estado, proximoSeguimiento: r.proximoSeguimiento, createdAt: r.createdAt }, now) }));
  const atrasados = withLate.filter((r) => r.atrasado).length;

  if (role !== "coord") {
    return NextResponse.json({
      total: withLate.length,
      atrasados,
      items: withLate.slice(0, MAX_ITEMS).map((r) => ({
        id: r.id,
        nombre: r.nombre,
        telefono: r.telefono,
        interes: r.interes,
        sucursal: r.sucursal,
        fuente: r.fuente,
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
  const ventasDesde = new Date(now.getTime() - VENTAS_DIAS * 86_400_000);
  const ventasRows = await prisma.lead.findMany({
    where: { estado: "VENTA", fechaCierre: { not: null }, updatedAt: { gte: ventasDesde } },
    orderBy: { updatedAt: "desc" },
    take: MAX_VENTAS,
    select: { id: true, nombre: true, sucursal: true, montoVenta: true, folioFactura: true, updatedAt: true },
  });

  return NextResponse.json({
    total: withLate.length,
    atrasados,
    items: [],
    porSucursal,
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
