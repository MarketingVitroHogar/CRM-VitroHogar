import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoord } from "@/lib/apiGuards";
import { generateTempPassword, hashPassword } from "@/lib/password";

type Params = { params: Promise<{ id: string }> };

// Restablece la contraseña con una temporal que se muestra UNA sola vez (no se guarda en claro).
export async function POST(_req: Request, { params }: Params) {
  const g = await requireCoord();
  if (g.error) return g.error;

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (!target.activo) return NextResponse.json({ error: "La cuenta está desactivada; reactívala primero" }, { status: 400 });

  const temp = generateTempPassword();
  await prisma.user.update({
    where: { id },
    // passwordChangedAt = null: al entrar, la persona vuelve a ver el aviso para elegir su propia contraseña.
    data: { passwordHash: await hashPassword(temp), passwordChangedAt: null, failedLoginCount: 0, lockedUntil: null },
  });

  return NextResponse.json({ ok: true, username: target.username, temporal: temp });
}
