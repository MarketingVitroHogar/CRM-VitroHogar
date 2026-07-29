import { z } from "zod";
import { SUCURSALES, FUENTES, ESTADOS, GERENTE_ALLOWED_ESTADOS } from "@/lib/catalogs";

// Plain "YYYY-MM-DD" strings (from <input type="date"> and Excel imports)
// are calendar dates, not instants. `new Date("2026-07-28")` parses that as
// UTC midnight, which then renders as the previous day in any timezone
// behind UTC (all of Mexico) — so every date-only string is parsed as LOCAL
// midnight instead, matching how it's later displayed and range-filtered.
function parseFlexibleDate(val: string | Date): Date {
  if (val instanceof Date) return val;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return new Date(`${val}T00:00:00`);
  return new Date(val);
}

const dateInput = z
  .union([z.string(), z.date()])
  .transform(parseFlexibleDate)
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Fecha inválida" });

const nullableDateInput = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((val) => {
    if (val === undefined || val === null || val === "") return null;
    const d = parseFlexibleDate(val);
    return Number.isNaN(d.getTime()) ? null : d;
  });

// Full schema — used by coord for create, and as the base for import.
export const LeadCreateSchema = z.object({
  fecha: dateInput,
  nombre: z.string().trim().min(1, "Nombre requerido"),
  telefono: z.string().trim().min(1, "Teléfono requerido"),
  sucursal: z.enum(SUCURSALES as [string, ...string[]]),
  interes: z.string().trim().default(""),
  fuente: z.enum(FUENTES as [string, ...string[]]),
  estado: z.enum(ESTADOS as [string, ...string[]]).default("NUEVO"),
  responsable: z.string().trim().optional(),
  proximoSeguimiento: nullableDateInput,
  notas: z.string().trim().default(""),
  folioCotizacion: z.string().trim().nullish(),
  folioFactura: z.string().trim().nullish(),
  montoVenta: z.union([z.number(), z.string(), z.null()]).optional(),
  fechaCierre: nullableDateInput,
});

// coord may PATCH any subset of fields (still re-validated against the lead's
// real sucursal / role rules in the route handler, not trusted here alone).
//
// This is intentionally NOT `LeadCreateSchema.partial()`: partial() keeps
// each field's `.default(...)`, and Zod applies a field's default whenever
// the key is absent from the input — which would silently reset e.g. estado
// back to "NUEVO" (or interes/notas to "") on every PATCH that simply
// doesn't mention them. Update schemas must mean "omitted = unchanged", so
// every field here is plain `.optional()` with no default.
export const LeadCoordUpdateSchema = z.object({
  fecha: dateInput.optional(),
  nombre: z.string().trim().min(1).optional(),
  telefono: z.string().trim().min(1).optional(),
  sucursal: z.enum(SUCURSALES as [string, ...string[]]).optional(),
  interes: z.string().trim().optional(),
  fuente: z.enum(FUENTES as [string, ...string[]]).optional(),
  estado: z.enum(ESTADOS as [string, ...string[]]).optional(),
  responsable: z.string().trim().optional(),
  proximoSeguimiento: nullableDateInput,
  notas: z.string().trim().optional(),
  folioCotizacion: z.string().trim().nullish(),
  folioFactura: z.string().trim().nullish(),
  montoVenta: z.union([z.number(), z.string(), z.null()]).optional(),
  fechaCierre: nullableDateInput,
});

// gerente may only ever send these 8 fields; estado is restricted server-side
// via isEstadoAllowedForGerente (kept out of the zod enum so "NUEVO" is a
// values-shape violation caught here too, not just a business-rule check).
export const LeadGerenteUpdateSchema = z
  .object({
    estado: z.enum(GERENTE_ALLOWED_ESTADOS as [string, ...string[]]).optional(),
    responsable: z.string().trim().min(1).optional(),
    proximoSeguimiento: nullableDateInput,
    notas: z.string().trim().optional(),
    folioCotizacion: z.string().trim().nullish(),
    folioFactura: z.string().trim().nullish(),
    montoVenta: z.union([z.number(), z.string(), z.null()]).optional(),
    fechaCierre: nullableDateInput,
  })
  .strict();
