import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiGuards";
import { isOverdue } from "@/lib/leadPolicy";
import { mexicoTodayAsUTCDate } from "@/lib/dateOnly";

const VENTANA_DIAS = 30; // solo leads ingresados en los últimos 30 días (evita ruido del historial)
const MAX_ITEMS = 15;

/**
 * Avisos de la campana: leads en estado "Nuevo" por atender.
 *  - Coordinación: todas las sucursales.
 *  - Gerente: solo su sucursal (el filtro se aplica aquí, en el servidor).
 * "Atrasado" usa la misma regla del CRM ("sin seguimiento a tiempo"). No guarda nada: se calcula al momento.
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
    take: 300,
    select: { id: true, nombre: true, telefono: true, interes: true, sucursal: true, fuente: true, createdAt: true, proximoSeguimiento: true, estado: true },
  });

  const now = new Date();
  const withLate = rows.map((r) => ({ ...r, atrasado: isOverdue({ estado: r.estado, proximoSeguimiento: r.proximoSeguimiento, createdAt: r.createdAt }, now) }));
  const atrasados = withLate.filter((r) => r.atrasado).length;

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
