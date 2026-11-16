import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Fuente, Sucursal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SUCURSALES, SUCURSAL_LABELS } from "@/lib/catalogs";
import { matchFuente, matchSucursal } from "@/lib/excelImport/columnMapping";
import { defaultResponsableFor } from "@/lib/leadPolicy";
import { mexicoTodayAsUTCDate } from "@/lib/dateOnly";
import { normalizeText } from "@/lib/textMatch";

/**
 * Puerta de entrada automática de leads (Meta Ads, WhatsApp, formularios…).
 * Un servicio externo (Zapier, Make, un formulario…) hace POST aquí con una clave secreta.
 *
 *   POST /api/intake/leads
 *   Cabecera:  x-api-key: <INTAKE_API_KEY>      (o  Authorization: Bearer <INTAKE_API_KEY>)
 *   Cuerpo:    { "nombre", "telefono", "sucursal", "fuente", "interes"?, "notas"? }
 *
 * El lead entra como "Nuevo", sin asesor, y aparece en la campana de Coordinación y de la sucursal.
 * Sin INTAKE_API_KEY configurada (24+ caracteres) la ruta queda desactivada.
 */

const DUPLICATE_WINDOW_DAYS = 14;

const Body = z.object({
  nombre: z.string().trim().min(2, "nombre requerido").max(120),
  telefono: z
    .string()
    .trim()
    .refine((v) => v.replace(/\D/g, "").length >= 10, "telefono: mínimo 10 dígitos")
    .max(30),
  sucursal: z.string().trim().min(1, "sucursal requerida"),
  fuente: z.string().trim().min(1, "fuente requerida"),
  interes: z.string().trim().max(200).optional(),
  notas: z.string().trim().max(500).optional(),
});

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function resolveSucursal(text: string): Sucursal | null {
  const key = text.trim().toUpperCase().replace(/[\s.]+/g, "_");
  if ((SUCURSALES as string[]).includes(key)) return key as Sucursal;
  return matchSucursal(text);
}

export async function POST(req: NextRequest) {
  const expected = process.env.INTAKE_API_KEY ?? "";
  if (expected.length < 24) {
    return NextResponse.json({ error: "La captura automática no está configurada" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  const given = req.headers.get("x-api-key") ?? (auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "");
  if (!given || !safeEqual(given, expected)) {
    return NextResponse.json({ error: "Clave inválida" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const d = parsed.data;

  const sucursal = resolveSucursal(d.sucursal);
  if (!sucursal) {
    return NextResponse.json({ error: `sucursal no reconocida. Valores válidos: ${SUCURSALES.join(", ")}` }, { status: 400 });
  }
  const fuente = matchFuente(normalizeText(d.fuente)) as Fuente | null;
  if (!fuente) {
    return NextResponse.json({ error: "fuente no reconocida. Valores válidos: facebook, instagram, tiktok, whatsapp, sitio web, referido, otro" }, { status: 400 });
  }

  // Evita duplicados: mismo teléfono (últimos 10 dígitos) en la misma sucursal en las últimas 2 semanas.
  const digits = d.telefono.replace(/\D/g, "").slice(-10);
  const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 86_400_000);
  const recent = await prisma.lead.findMany({ where: { sucursal, createdAt: { gte: since } }, select: { id: true, telefono: true } });
  const dup = recent.find((r) => r.telefono.replace(/\D/g, "").slice(-10) === digits);
  if (dup) return NextResponse.json({ id: dup.id, duplicate: true });

  const lead = await prisma.lead.create({
    data: {
      fecha: mexicoTodayAsUTCDate(),
      nombre: d.nombre,
      telefono: d.telefono,
      sucursal,
      interes: d.interes ?? "",
      fuente,
      estado: "NUEVO",
      responsable: defaultResponsableFor(sucursal),
      asesor: null,
      notas: d.notas ? `Captura automática: ${d.notas}` : "Captura automática",
    },
    select: { id: true },
  });

  return NextResponse.json({ id: lead.id, duplicate: false, sucursal: SUCURSAL_LABELS[sucursal] }, { status: 201 });
}
