import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Posibles duplicados de un teléfono (mismos últimos 10 dígitos), para avisar al capturar un lead a mano.
 * El gerente solo ve coincidencias de su sucursal; Coordinación, de todas.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const digits = (searchParams.get("telefono") ?? "").replace(/[^0-9]/g, "").slice(-10);
  const excluir = searchParams.get("excluir");
  if (digits.length < 10) return NextResponse.json({ duplicados: [] });

  const candidates = await prisma.lead.findMany({
    where: {
      telefono: { contains: digits.slice(-4) },
      ...(excluir ? { id: { not: excluir } } : {}),
      ...(session.user.role === "gerente" ? { sucursal: session.user.sucursal! } : {}),
    },
    orderBy: { fecha: "desc" },
    take: 200,
    select: { id: true, nombre: true, telefono: true, sucursal: true, estado: true, fecha: true },
  });
  const duplicados = candidates.filter((l) => l.telefono.replace(/[^0-9]/g, "").slice(-10) === digits).slice(0, 5);

  return NextResponse.json({ duplicados });
}
