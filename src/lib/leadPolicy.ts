import { differenceInCalendarDays } from "date-fns";
import { Estado, Sucursal } from "@prisma/client";
import {
  GERENTE_ALLOWED_ESTADOS,
  RESPONSABLE_CM,
  RESPONSABLE_COORDINADOR,
  gerenteResponsableLabel,
} from "./catalogs";

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
  if (lead.estado === "VENTA" || lead.estado === "PERDIDO") return false;
  if (lead.proximoSeguimiento) return lead.proximoSeguimiento < now;
  return differenceInCalendarDays(now, lead.fecha) > 2;
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

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
