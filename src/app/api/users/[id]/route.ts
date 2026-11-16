import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoord } from "@/lib/apiGuards";

type Params = { params: Promise<{ id: string }> };

const Schema = z.object({ activo: z.boolean() }).strict();

// Activar / desactivar una cuenta. No se borra nada: leads e historial se conservan.
export async function PATCH(req: NextRequest, { params }: Params) {
  const g = await requireCoord();
  if (g.error) return g.error;

  const { id } = await params;
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (!parsed.data.activo) {
    if (target.id === g.session.user.id) {
      return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
    }
    if (target.role === "coord") {
      const otrosCoord = await prisma.user.count({ where: { role: "coord", activo: true, id: { not: target.id } } });
      if (otrosCoord === 0) {
        return NextResponse.json({ error: "No se puede desactivar la última cuenta de Coordinación activa" }, { status: 400 });
      }
    }
  }

  await prisma.user.update({ where: { id }, data: { activo: parsed.data.activo } });
  return NextResponse.json({ ok: true, activo: parsed.data.activo });
}
