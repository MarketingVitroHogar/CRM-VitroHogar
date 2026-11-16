import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiGuards";
import { hashPassword, newPasswordSchema, verifyPassword } from "@/lib/password";

const Schema = z
  .object({
    actual: z.string().min(1, "Escribe tu contraseña actual"),
    nueva: newPasswordSchema,
    confirmar: z.string(),
  })
  .strict()
  .refine((v) => v.nueva === v.confirmar, { message: "La confirmación no coincide con la contraseña nueva", path: ["confirmar"] })
  .refine((v) => v.nueva !== v.actual, { message: "La contraseña nueva debe ser distinta a la actual", path: ["nueva"] });

// Cambio de contraseña propio: pide la actual, exige 8+ caracteres y guarda SIEMPRE el hash.
export async function POST(req: NextRequest) {
  const g = await requireSession();
  if (g.error) return g.error;

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: g.session.user.id } });
  if (!user || !user.activo) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!(await verifyPassword(parsed.data.actual, user.passwordHash))) {
    return NextResponse.json({ error: "La contraseña actual no es correcta" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.nueva), passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });

  return NextResponse.json({ ok: true });
}
