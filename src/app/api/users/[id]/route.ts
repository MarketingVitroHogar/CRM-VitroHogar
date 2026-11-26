import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoord } from "@/lib/apiGuards";
import { NOMINA_AYUDA, parseNomina } from "@/lib/nomina";

type Params = { params: Promise<{ id: string }> };

// Una sola acción por llamada: activar/desactivar, o corregir el número de nómina (usuario) de un asesor.
const Schema = z.union([z.object({ activo: z.boolean() }).strict(), z.object({ username: z.string() }).strict()]);

// Activar / desactivar una cuenta (no se borra nada: leads e historial se conservan) o cambiar la nómina de un asesor.
export async function PATCH(req: NextRequest, { params }: Params) {
  const g = await requireCoord();
  if (g.error) return g.error;

  const { id } = await params;
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // ---- Cambiar la nómina (solo cuentas de asesor) ----
  if ("username" in parsed.data) {
    if (target.role !== "asesor") {
      return NextResponse.json({ error: "Solo se puede cambiar el usuario de las cuentas de asesor" }, { status: 400 });
    }
    const nomina = parseNomina(parsed.data.username);
    if (!nomina) return NextResponse.json({ error: NOMINA_AYUDA }, { status: 400 });
    if (nomina !== target.username) {
      if (await prisma.user.findUnique({ where: { username: nomina } })) {
        return NextResponse.json({ error: `El usuario ${nomina} ya existe` }, { status: 409 });
      }
      // Las sesiones abiertas siguen válidas: el usuario se relee de la base en cada lectura.
      await prisma.user.update({ where: { id }, data: { username: nomina } });
    }
    return NextResponse.json({ ok: true, username: nomina });
  }

  // ---- Activar / desactivar ----
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
