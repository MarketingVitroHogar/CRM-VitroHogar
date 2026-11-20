import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCanCreate, ForbiddenError } from "@/lib/permissions";
import { LeadCreateSchema } from "@/lib/validation/leadSchemas";
import {
  autoProximoSeguimientoIfMissing,
  defaultResponsableFor,
  isValidResponsableFor,
  resolveFechaCierre,
} from "@/lib/leadPolicy";
import { dayRangeUTC, mexicoTodayAsUTCDate, monthRangeUTC } from "@/lib/dateOnly";
import { searchLeadIds } from "@/lib/leadSearch";
import { isDateStr } from "@/lib/periodos";
import { KANBAN_COLUMNS } from "@/lib/kanban";
import { Sucursal } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("mes"); // YYYY-MM (se conserva por compatibilidad)
  const desde = searchParams.get("desde"); // YYYY-MM-DD (incluido) — fecha de ingreso
  const hasta = searchParams.get("hasta"); // YYYY-MM-DD (incluido)
  const estado = searchParams.get("estado");
  const sucursalParam = searchParams.get("sucursal");
  const orden = searchParams.get("orden") === "asc" ? "asc" : "desc";
  const q = searchParams.get("q")?.trim();
  const qEnPeriodo = searchParams.get("qEnPeriodo") === "1"; // buscar solo dentro del periodo elegido

  if ((desde && !isDateStr(desde)) || (hasta && !isDateStr(hasta)) || (!!desde !== !!hasta)) {
    return NextResponse.json({ error: "Periodo inválido: usa desde y hasta con formato AAAA-MM-DD" }, { status: 400 });
  }

  const where: Record<string, unknown> = {};

  // gerente is always scoped server-side to their own branch, regardless of
  // any sucursal query param a client might send.
  if (session.user.role === "gerente") {
    where.sucursal = session.user.sucursal;
  } else if (sucursalParam) {
    where.sucursal = sucursalParam;
  }

  // "Sin seguimiento": leads Nuevos con el seguimiento vencido, o sin fecha de seguimiento y con más de 24 h
  // sin atender (la misma regla que marca "Sin seguimiento a tiempo" en la lista).
  if (estado === "SIN_SEGUIMIENTO") {
    const hoy = mexicoTodayAsUTCDate();
    const hace24h = new Date(Date.now() - 24 * 3_600_000);
    where.estado = "NUEVO";
    where.AND = [{ OR: [{ proximoSeguimiento: { lt: hoy } }, { proximoSeguimiento: null, createdAt: { lt: hace24h } }] }];
  } else if (estado) {
    // Filtrar por una columna (Contactado / Cotización) incluye también sus estados históricos (No respondió / Seguimiento).
    const col = KANBAN_COLUMNS.find((c) => c.target === estado);
    where.estado = col ? { in: col.estados } : estado;
  }

  // "Por asignar": leads abiertos que todavía no tienen asesor.
  if (searchParams.get("sinAsesor") === "1") {
    where.asesor = null;
    if (!estado) where.estado = { notIn: ["VENTA", "PERDIDO"] };
  }

  // Por defecto, una búsqueda ignora el periodo: encontrar a un cliente por nombre o teléfono
  // no debe obligar a adivinar cuándo llegó. Con qEnPeriodo=1 se busca solo dentro del periodo.
  const aplicaPeriodo = !q || qEnPeriodo;
  if (aplicaPeriodo) {
    if (desde && hasta) {
      const { start, end } = dayRangeUTC(desde, hasta);
      where.fecha = { gte: start, lt: end };
    } else if (month && /^\d{4}-\d{2}$/.test(month)) {
      const { start, end } = monthRangeUTC(month);
      where.fecha = { gte: start, lt: end };
    }
  }

  if (q) {
    // Búsqueda sin acentos, por varias palabras, por dígitos del teléfono y en más campos (ver leadSearch.ts).
    const candidates = await prisma.lead.findMany({
      where,
      select: { id: true, nombre: true, telefono: true, interes: true, asesor: true, folioCotizacion: true, folioFactura: true },
    });
    const ids = searchLeadIds(candidates, q);
    const leads = ids.length ? await prisma.lead.findMany({ where: { id: { in: ids } }, orderBy: [{ fecha: orden }, { createdAt: orden }] }) : [];
    return NextResponse.json({ leads, count: leads.length });
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

    // Coordinación elige la sucursal; el asesor lo asigna después el gerente.
    if (data.asesor?.trim()) {
      return NextResponse.json({ error: "Coordinación no asigna asesor: lo asigna el gerente de la sucursal." }, { status: 400 });
    }
    const asesor = null;

    const estado = (data.estado ?? "NUEVO") as "NUEVO" | "CONTACTADO" | "COTIZACION" | "SEGUIMIENTO" | "NO_RESPONDIO" | "VENTA" | "PERDIDO";
    const fechaCierre = resolveFechaCierre(estado, data.fechaCierre ?? null);
    const proximoSeguimiento = autoProximoSeguimientoIfMissing(estado, data.proximoSeguimiento ?? null);

    const lead = await prisma.lead.create({
      data: {
        fecha: data.fecha ?? mexicoTodayAsUTCDate(),
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
