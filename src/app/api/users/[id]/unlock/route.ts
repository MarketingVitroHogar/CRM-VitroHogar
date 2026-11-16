import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoord } from "@/lib/apiGuards";

type Params = { params: Promise<{ id: string }> };

// Quita el bloqueo temporal por intentos fallidos.
export async function POST(_req: Request, { params }: Params) {
  const g = await requireCoord();
  if (g.error) return g.error;

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  await prisma.user.update({ where: { id }, data: { failedLoginCount: 0, lockedUntil: null } });
  return NextResponse.json({ ok: true });
}
