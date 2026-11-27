import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoord } from "@/lib/apiGuards";
import { SUCURSALES } from "@/lib/catalogs";
import { limpiarNombre } from "@/lib/bajaAsesor";

// Catálogo completo (activos y dados de baja) con cuántos leads tiene cada asesor y si ya tiene usuario. Solo Coordinación.
export async function GET() {
  const g = await requireCoord();
  if (g.error) return g.error;

  const [asesores, leads, cuentas] = await Promise.all([
    prisma.asesor.findMany({ orderBy: [{ sucursal: "asc" }, { orden: "asc" }, { nombre: "asc" }] }),
    prisma.lead.groupBy({ by: ["sucursal", "asesor"], where: { asesor: { not: null } }, _count: true }),
    prisma.user.findMany({ where: { role: "asesor" }, select: { sucursal: true, asesor: true, username: true, activo: true } }),
  ]);
  const nLeads = new Map(leads.map((l) => [`${l.sucursal}|${l.asesor}`, l._count]));
  const cuenta = new Map(cuentas.map((c) => [`${c.sucursal}|${c.asesor}`, c]));
  return NextResponse.json({
    asesores: asesores.map((a) => ({
      id: a.id,
      sucursal: a.sucursal,
      nombre: a.nombre,
      activo: a.activo,
      leads: nLeads.get(`${a.sucursal}|${a.nombre}`) ?? 0,
      usuario: cuenta.get(`${a.sucursal}|${a.nombre}`)?.username ?? null,
      usuarioActivo: cuenta.get(`${a.sucursal}|${a.nombre}`)?.activo ?? null,
    })),
  });
}

const CreateSchema = z.object({ sucursal: z.enum(SUCURSALES as [string, ...string[]]), nombre: z.string() }).strict();

// Agrega un asesor a una sucursal (o reactiva uno dado de baja con el mismo nombre). Solo Coordinación.
export async function POST(req: NextRequest) {
  const g = await requireCoord();
  if (g.error) return g.error;

  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const sucursal = parsed.data.sucursal as (typeof SUCURSALES)[number];
  const nombre = limpiarNombre(parsed.data.nombre);
  if (nombre.length < 2 || nombre.length > 80) {
    return NextResponse.json({ error: "Escribe el nombre completo del asesor (de 2 a 80 caracteres)." }, { status: 400 });
  }

  // Mismo nombre (sin importar mayúsculas) en la misma sucursal.
  const igual = await prisma.asesor.findFirst({ where: { sucursal, nombre: { equals: nombre, mode: "insensitive" } } });
  if (igual?.activo) return NextResponse.json({ error: `${igual.nombre} ya está en esta sucursal` }, { status: 409 });
  if (igual) {
    const a = await prisma.asesor.update({ where: { id: igual.id }, data: { activo: true } });
    return NextResponse.json({ ok: true, id: a.id, nombre: a.nombre, reactivado: true });
  }

  const max = await prisma.asesor.aggregate({ where: { sucursal }, _max: { orden: true } });
  const a = await prisma.asesor.create({ data: { sucursal, nombre, orden: (max._max.orden ?? -1) + 1 } });
  return NextResponse.json({ ok: true, id: a.id, nombre: a.nombre, reactivado: false }, { status: 201 });
}
