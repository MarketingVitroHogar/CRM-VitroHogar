import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCanCreate, ForbiddenError } from "@/lib/permissions";
import { LeadCreateSchema } from "@/lib/validation/leadSchemas";
import {
  autoProximoSeguimientoIfMissing,
  defaultResponsableFor,
  isValidAsesorFor,
  isValidResponsableFor,
  resolveFechaCierre,
} from "@/lib/leadPolicy";
import { monthRangeUTC } from "@/lib/dateOnly";
import { Sucursal } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("mes"); // YYYY-MM, filters by fecha (ingreso)
  const estado = searchParams.get("estado");
  const sucursalParam = searchParams.get("sucursal");
  const orden = searchParams.get("orden") === "asc" ? "asc" : "desc";
  const q = searchParams.get("q")?.trim();

  const where: Record<string, unknown> = {};

  // gerente is always scoped server-side to their own branch, regardless of
  // any sucursal query param a client might send.
  if (session.user.role === "gerente") {
    where.sucursal = session.user.sucursal;
  } else if (sucursalParam) {
    where.sucursal = sucursalParam;
  }

  if (estado) where.estado = estado;

  // A search query intentionally ignores the mes filter — looking up a
  // specific customer by name/phone shouldn't require first guessing which
  // month they came in.
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { telefono: { contains: q } },
    ];
  } else if (month) {
    const { start, end } = monthRangeUTC(month);
    where.fecha = { gte: start, lt: end };
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { fecha: orden },
  });

  return NextResponse.json({ leads, count: leads.length });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    assertCanCreate(session.user);

    const body = await req.json();
    const parsed = LeadCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const sucursal = data.sucursal as Sucursal;

    const responsable = data.responsable?.trim() || defaultResponsableFor(sucursal);
    if (!isValidResponsableFor(sucursal, responsable)) {
      return NextResponse.json(
        { error: `responsable inválido para la sucursal seleccionada` },
        { status: 400 }
      );
    }

    const asesor = data.asesor?.trim() || null;
    if (!isValidAsesorFor(sucursal, asesor)) {
      return NextResponse.json(
        { error: "asesor inválido para la sucursal seleccionada" },
        { status: 400 }
      );
    }

    const estado = (data.estado ?? "NUEVO") as "NUEVO" | "CONTACTADO" | "COTIZACION" | "SEGUIMIENTO" | "NO_RESPONDIO" | "VENTA" | "PERDIDO";
    const fechaCierre = resolveFechaCierre(estado, data.fechaCierre ?? null);
    const proximoSeguimiento = autoProximoSeguimientoIfMissing(estado, data.proximoSeguimiento ?? null);

    const lead = await prisma.lead.create({
      data: {
        fecha: data.fecha,
        nombre: data.nombre,
        telefono: data.telefono,
        sucursal,
        interes: data.interes ?? "",
        fuente: data.fuente as never,
        estado,
        responsable,
        asesor,
        proximoSeguimiento,
        notas: data.notas ?? "",
        folioCotizacion: data.folioCotizacion ?? null,
        folioFactura: data.folioFactura ?? null,
        montoVenta: data.montoVenta != null ? String(data.montoVenta) : null,
        fechaCierre,
      },
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}
