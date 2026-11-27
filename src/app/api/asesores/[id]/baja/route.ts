import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCoord } from "@/lib/apiGuards";
import { BajaSchema, condicionTraspaso, limpiarNombre } from "@/lib/bajaAsesor";

type Params = { params: Promise<{ id: string }> };

/**
 * Da de baja a un asesor. Solo Coordinación.
 * - `confirmar: false` -> VISTA PREVIA: cuántos leads se moverían y cuántos se quedan como histórico (no cambia nada).
 * - `confirmar: true`  -> aplica: (opcional) alta del reemplazo, traspaso de los leads elegidos, baja del asesor y
 *   desactivación de su usuario si tenía. Nada se borra; el traspaso no cambia la fecha de actualización de los leads.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const g = await requireCoord();
  if (g.error) return g.error;

  const { id } = await params;
  const parsed = BajaSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const body = parsed.data;

  if (body.desde && body.hasta && body.desde > body.hasta) {
    return NextResponse.json({ error: "La fecha “Desde” no puede ser posterior a “Hasta”." }, { status: 400 });
  }
  if (body.reemplazoId && body.reemplazoNuevo) {
    return NextResponse.json({ error: "Elige un reemplazo existente o escribe uno nuevo, no los dos." }, { status: 400 });
  }

  const saliente = await prisma.asesor.findUnique({ where: { id } });
  if (!saliente) return NextResponse.json({ error: "Asesor no encontrado" }, { status: 404 });
  if (!saliente.activo) return NextResponse.json({ error: "Ese asesor ya está dado de baja" }, { status: 409 });
  const { sucursal } = saliente;

  // ---- Reemplazo (opcional si no se traspasan leads; obligatorio si se traspasan) ----
  let reemplazo: { id: string; nombre: string; activo: boolean } | null = null;
  let reemplazoNuevoNombre: string | null = null;
  if (body.reemplazoId) {
    const r = await prisma.asesor.findUnique({ where: { id: body.reemplazoId } });
    if (!r || r.sucursal !== sucursal || r.id === saliente.id || !r.activo) {
      return NextResponse.json({ error: "El reemplazo debe ser otro asesor activo de la misma sucursal" }, { status: 400 });
    }
    reemplazo = r;
  } else if (body.reemplazoNuevo) {
    const nombre = limpiarNombre(body.reemplazoNuevo);
    if (nombre.toLowerCase() === saliente.nombre.toLowerCase()) {
      return NextResponse.json({ error: "El reemplazo no puede ser el mismo asesor" }, { status: 400 });
    }
    const igual = await prisma.asesor.findFirst({ where: { sucursal, nombre: { equals: nombre, mode: "insensitive" } } });
    if (igual) reemplazo = igual; // ya existe (activo o dado de baja): se usa / se reactiva
    else reemplazoNuevoNombre = nombre;
  }
  if (body.traspasar && !reemplazo && !reemplazoNuevoNombre) {
    return NextResponse.json({ error: "Para pasar leads necesitas indicar quién los recibe." }, { status: 400 });
  }
  const nombreReemplazo = reemplazo?.nombre ?? reemplazoNuevoNombre;

  // ---- Vista previa: leads del asesor por mes y estado, marcando cuáles se moverían ----
  const cond = body.traspasar ? condicionTraspaso(sucursal, saliente.nombre, body) : Prisma.sql`FALSE`;
  const filas = await prisma.$queryRaw<{ mes: string; estado: string; mueve: boolean; n: number }[]>`
    SELECT to_char("fecha", 'YYYY-MM') AS mes, "estado"::text AS estado, (${cond}) AS mueve, count(*)::int AS n
    FROM "Lead" WHERE "sucursal"::text = ${sucursal} AND "asesor" = ${saliente.nombre}
    GROUP BY 1, 2, 3 ORDER BY 1 DESC, 2`;
  const aMover = filas.filter((f) => f.mueve).reduce((s, f) => s + f.n, 0);
  const total = filas.reduce((s, f) => s + f.n, 0);
  const cuenta = await prisma.user.findFirst({ where: { role: "asesor", sucursal, asesor: saliente.nombre }, select: { username: true, activo: true } });

  if (!body.confirmar) {
    return NextResponse.json({
      preview: true,
      asesor: saliente.nombre,
      reemplazo: nombreReemplazo,
      reemplazoEsNuevo: !!reemplazoNuevoNombre || (!!reemplazo && !reemplazo.activo),
      total,
      aMover,
      seQuedan: total - aMover,
      filas,
      cuenta: cuenta ? { username: cuenta.username, activo: cuenta.activo } : null,
    });
  }

  // ---- Aplicar (todo o nada) ----
  const res = await prisma.$transaction(async (tx) => {
    let reemplazoNombre: string | null = null;
    if (reemplazo) {
      if (!reemplazo.activo) await tx.asesor.update({ where: { id: reemplazo.id }, data: { activo: true } });
      reemplazoNombre = reemplazo.nombre;
    } else if (reemplazoNuevoNombre) {
      const max = await tx.asesor.aggregate({ where: { sucursal }, _max: { orden: true } });
      await tx.asesor.create({ data: { sucursal, nombre: reemplazoNuevoNombre, orden: (max._max.orden ?? -1) + 1 } });
      reemplazoNombre = reemplazoNuevoNombre;
    }

    let traspasados = 0;
    if (body.traspasar && reemplazoNombre) {
      // SQL directo: con Prisma cada lead cambiaría su fecha de actualización y parecería recién tocado.
      traspasados = await tx.$executeRaw`UPDATE "Lead" SET "asesor" = ${reemplazoNombre} WHERE ${condicionTraspaso(sucursal, saliente.nombre, body)}`;
    }

    await tx.asesor.update({ where: { id: saliente.id }, data: { activo: false } });
    // Si tenía usuario, se desactiva (la sesión abierta se cierra sola: el usuario se revalida en cada lectura).
    const cuentas = await tx.user.updateMany({ where: { role: "asesor", sucursal, asesor: saliente.nombre, activo: true }, data: { activo: false } });
    return { traspasados, reemplazo: reemplazoNombre, cuentaDesactivada: cuentas.count > 0 };
  });

  return NextResponse.json({ ok: true, ...res, seQuedan: total - res.traspasados });
}
