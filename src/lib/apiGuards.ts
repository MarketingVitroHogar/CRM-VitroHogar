import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";

type Guard = { session: Session; error?: undefined } | { session?: undefined; error: NextResponse };

/** Sesión válida (la cuenta debe seguir activa: auth.ts la revalida en cada lectura). */
export async function requireSession(): Promise<Guard> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  return { session };
}

/** Solo Coordinación: el permiso se exige aquí, en el servidor, no solo ocultando botones. */
export async function requireCoord(): Promise<Guard> {
  const g = await requireSession();
  if (g.error) return g;
  if (g.session.user.role !== "coord") {
    return { error: NextResponse.json({ error: "Solo Coordinación puede hacer esto" }, { status: 403 }) };
  }
  return g;
}
