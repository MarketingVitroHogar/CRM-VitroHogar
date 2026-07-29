import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assertCanAccessLead,
  assertCanDelete,
  filterEditableFields,
  ForbiddenError,
} from "@/lib/permissions";
import { LeadCoordUpdateSchema, LeadGerenteUpdateSchema } from "@/lib/validation/leadSchemas";
import { defaultResponsableFor, isValidResponsableFor, resolveFechaCierre } from "@/lib/leadPolicy";
import { Sucursal, Estado } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  try {
    assertCanAccessLead(session.user, lead);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  return NextResponse.json({ lead });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  try {
    assertCanAccessLead(session.user, existing);

    const body = await req.json();
    const schema = session.user.role === "coord" ? LeadCoordUpdateSchema : LeadGerenteUpdateSchema;
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Belt-and-suspenders: even though the gerente schema is `.strict()` and
    // already rejects unknown keys, re-filter against the same whitelist so
    // this never silently regresses if the schemas drift apart later.
    const patch = filterEditableFields(session.user, parsed.data as Record<string, unknown>);

    const nextSucursal = (patch.sucursal as Sucursal | undefined) ?? existing.sucursal;

    if (patch.responsable !== undefined) {
      if (!isValidResponsableFor(nextSucursal, patch.responsable as string)) {
        return NextResponse.json(
          { error: "responsable inválido para la sucursal del lead" },
          { status: 400 }
        );
      }
    } else if (patch.sucursal !== undefined && patch.sucursal !== existing.sucursal) {
      // coord changed sucursal without explicitly setting responsable -> auto
      // reassign to the new branch's gerente, per spec.
      patch.responsable = defaultResponsableFor(nextSucursal);
    }

    const nextEstado = (patch.estado as Estado | undefined) ?? existing.estado;
    const submittedFechaCierre =
      patch.fechaCierre !== undefined ? (patch.fechaCierre as Date | null) : existing.fechaCierre;
    patch.fechaCierre = resolveFechaCierre(nextEstado, submittedFechaCierre);

    if (patch.montoVenta !== undefined) {
      patch.montoVenta = patch.montoVenta == null ? null : String(patch.montoVenta);
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: patch,
    });

    return NextResponse.json({ lead });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  try {
    assertCanDelete(session.user);
    await prisma.lead.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}
