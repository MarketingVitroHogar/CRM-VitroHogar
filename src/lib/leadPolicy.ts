import { Estado, Sucursal } from "@prisma/client";
import {
  GERENTE_ALLOWED_ESTADOS,
  RESPONSABLE_CM,
  RESPONSABLE_COORDINADOR,
  gerenteResponsableLabel,
} from "./catalogs";
import { mexicoTodayAsUTCDate, calendarDateUTC } from "./dateOnly";

export function responsableOptionsFor(sucursal: Sucursal): string[] {
  return [RESPONSABLE_CM, RESPONSABLE_COORDINADOR, gerenteResponsableLabel(sucursal)];
}

export function defaultResponsableFor(sucursal: Sucursal): string {
  return gerenteResponsableLabel(sucursal);
}

export function isValidResponsableFor(sucursal: Sucursal, responsable: string): boolean {
  return responsableOptionsFor(sucursal).includes(responsable);
}

export function isOverdue(
  lead: { estado: Estado; proximoSeguimiento: Date | null; fecha: Date },
  now: Date = new Date()
): boolean {
  if (lead.estado === "VENTA" || lead.estado === "PERDIDO" || lead.estado === "NO_RESPONDIO") return false;

  const today = mexicoTodayAsUTCDate(now);
  if (lead.proximoSeguimiento) return calendarDateUTC(lead.proximoSeguimiento) < today;

  const daysSinceFecha = Math.round(
    (today.getTime() - calendarDateUTC(lead.fecha).getTime()) / 86_400_000
  );
  return daysSinceFecha > 2;
}

export function resolveFechaCierre(
  estado: Estado,
  submittedFechaCierre: Date | null | undefined,
  now: Date = new Date()
): Date | null {
  if (estado !== "VENTA" && estado !== "PERDIDO") return null;
  return submittedFechaCierre ?? now;
}

export function isEstadoAllowedForGerente(estado: Estado): boolean {
  return GERENTE_ALLOWED_ESTADOS.includes(estado);
}

// Estados where a lead is actively being worked but isn't yet resolved
// (Venta/Perdido/No respondió are fully exempt from the overdue check, and
// Nuevo already gets its own grace period via the ">2 days since fecha"
// fallback) — these are the ones where leaving proximoSeguimiento blank
// would otherwise silently drift into "sin seguimiento a tiempo".
const ESTADOS_QUE_REQUIEREN_SEGUIMIENTO: Estado[] = ["CONTACTADO", "COTIZACION", "SEGUIMIENTO"];

/**
 * Ensures a lead moving into (or staying in) an actively-worked estado
 * always has a próximo seguimiento — auto-assigning "hoy + 2 días" (Mexico
 * calendar) if none was submitted, rather than leaving it null and letting
 * the lead silently go overdue with no plan. An explicit date the user
 * picked always wins; this only fills the gap.
 */
export function autoProximoSeguimientoIfMissing(
  estado: Estado,
  submitted: Date | null,
  now: Date = new Date()
): Date | null {
  if (submitted) return submitted;
  if (!ESTADOS_QUE_REQUIEREN_SEGUIMIENTO.includes(estado)) return submitted;
  const today = mexicoTodayAsUTCDate(now);
  return new Date(today.getTime() + 2 * 86_400_000);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
