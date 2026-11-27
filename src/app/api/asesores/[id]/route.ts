import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoord } from "@/lib/apiGuards";

type Params = { params: Promise<{ id: string }> };

// Reactiva un asesor dado de baja. (Dar de baja se hace en /baja, porque pide qué pasa con sus leads.) Solo Coordinación.
// Su usuario, si tenía, no se reactiva solo: se reactiva desde la pestaña Usuarios.
export async function PATCH(req: NextRequest, { params }: Params) {
  const g = await requireCoord();
  if (g.error) return g.error;

  const { id } = await params;
  const parsed = z.object({ activo: z.literal(true) }).strict().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const a = await prisma.asesor.findUnique({ where: { id } });
  if (!a) return NextResponse.json({ error: "Asesor no encontrado" }, { status: 404 });
  if (!a.activo) await prisma.asesor.update({ where: { id }, data: { activo: true } });
  return NextResponse.json({ ok: true });
}
