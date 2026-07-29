import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCanImport, ForbiddenError } from "@/lib/permissions";
import { SUCURSALES, FUENTES } from "@/lib/catalogs";
import { defaultResponsableFor } from "@/lib/leadPolicy";
import type { Sucursal, Fuente } from "@prisma/client";

const ImportRowSchema = z.object({
  fecha: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "Fecha inválida"),
  nombre: z.string().trim().min(1),
  telefono: z.string().trim().optional().default(""),
  interes: z.string().trim().optional().default(""),
  fuente: z.enum(FUENTES as [string, ...string[]]),
  sucursal: z.enum(SUCURSALES as [string, ...string[]]),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    assertCanImport(session.user);

    const body = await req.json();
    const rowsInput = Array.isArray(body?.rows) ? body.rows : [];

    const validRows: {
      fecha: Date;
      nombre: string;
      telefono: string;
      interes: string;
      fuente: Fuente;
      sucursal: Sucursal;
      estado: "NUEVO";
      responsable: string;
    }[] = [];
    const rejected: { index: number; error: unknown }[] = [];

    rowsInput.forEach((row: unknown, index: number) => {
      const parsed = ImportRowSchema.safeParse(row);
      if (!parsed.success) {
        rejected.push({ index, error: parsed.error.flatten() });
        return;
      }
      const sucursal = parsed.data.sucursal as Sucursal;
      validRows.push({
        fecha: new Date(parsed.data.fecha),
        nombre: parsed.data.nombre,
        telefono: parsed.data.telefono,
        interes: parsed.data.interes,
        fuente: parsed.data.fuente as Fuente,
        sucursal,
        estado: "NUEVO",
        responsable: defaultResponsableFor(sucursal),
      });
    });

    if (validRows.length > 0) {
      await prisma.lead.createMany({ data: validRows });
    }

    return NextResponse.json({ imported: validRows.length, rejected });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}
