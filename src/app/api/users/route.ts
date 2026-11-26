import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoord } from "@/lib/apiGuards";

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
