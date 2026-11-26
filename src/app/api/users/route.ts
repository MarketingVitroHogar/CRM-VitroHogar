import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoord } from "@/lib/apiGuards";
import { SUCURSALES, asesoresFor } from "@/lib/catalogs";
import { NOMINA_AYUDA, parseNomina } from "@/lib/nomina";
import { generateTempPassword, hashPassword } from "@/lib/password";

// Lista de cuentas para la pantalla "Usuarios" (solo Coordinación). Nunca devuelve el hash.
export async function GET() {
  const g = await requireCoord();
  if (g.error) return g.error;

  const rows = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: { id: true, username: true, role: true, sucursal: true, asesor: true, activo: true, passwordChangedAt: true, lockedUntil: true },
  });
  const now = Date.now();
  return NextResponse.json({
    users: rows.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      sucursal: u.sucursal,
      asesor: u.asesor,
      activo: u.activo,
      passwordChangedAt: u.passwordChangedAt ? u.passwordChangedAt.toISOString() : null,
      bloqueada: !!u.lockedUntil && u.lockedUntil.getTime() > now,
      isMe: u.id === g.session.user.id,
    })),
  });
}

const CreateSchema = z
  .object({
    sucursal: z.enum(SUCURSALES as [string, ...string[]]),
    asesor: z.string().trim().min(1),
    username: z.string(),
  })
  .strict();

/**
 * Crea la cuenta de un asesor del catálogo de una sucursal (solo Coordinación). El usuario es su número de nómina.
 * Nace con una contraseña temporal que se muestra UNA sola vez; al entrar, la persona verá el aviso para elegir la suya.
 */
export async function POST(req: NextRequest) {
  const g = await requireCoord();
  if (g.error) return g.error;

  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { sucursal, asesor } = parsed.data;
  const sucursalOk = sucursal as (typeof SUCURSALES)[number];

  const nomina = parseNomina(parsed.data.username);
  if (!nomina) return NextResponse.json({ error: NOMINA_AYUDA }, { status: 400 });

  // El nombre debe ser exactamente el del catálogo de la sucursal: es el que se guarda en cada lead.
  if (!asesoresFor(sucursalOk).includes(asesor)) {
    return NextResponse.json({ error: "Ese asesor no está en el catálogo de la sucursal" }, { status: 400 });
  }
  if (await prisma.user.findFirst({ where: { sucursal: sucursalOk, asesor } })) {
    return NextResponse.json({ error: "Ese asesor ya tiene usuario" }, { status: 409 });
  }
  if (await prisma.user.findUnique({ where: { username: nomina } })) {
    return NextResponse.json({ error: `El usuario ${nomina} ya existe` }, { status: 409 });
  }

  const temporal = generateTempPassword();
  const user = await prisma.user.create({
    data: { username: nomina, passwordHash: await hashPassword(temporal), role: "asesor", sucursal: sucursalOk, asesor },
  });
  return NextResponse.json({ ok: true, id: user.id, username: user.username, temporal }, { status: 201 });
}
