import { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * Qué leads del asesor que sale pasan al reemplazo.
 * - `traspasar: false` -> ninguno: todo queda a nombre del asesor que sale, como histórico.
 * - `traspasar: true`  -> los que cumplan el periodo (desde/hasta, por fecha de ingreso del lead; vacío = sin límite)
 *   y, si `soloAbiertos`, solo los que aún no están vendidos ni perdidos.
 */
export const BajaSchema = z
  .object({
    traspasar: z.boolean(),
    reemplazoId: z.string().min(1).optional(),
    reemplazoNuevo: z.string().trim().min(2).max(80).optional(),
    desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    soloAbiertos: z.boolean().default(false),
    confirmar: z.boolean().default(false), // false = solo vista previa
  })
  .strict();
export type BajaInput = z.infer<typeof BajaSchema>;

/** Quita espacios de más y deja un solo espacio entre palabras. */
export function limpiarNombre(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Condición SQL de los leads que se traspasan (siempre sobre la sucursal y el asesor que sale). */
export function condicionTraspaso(sucursal: string, asesor: string, f: Pick<BajaInput, "desde" | "hasta" | "soloAbiertos">): Prisma.Sql {
  const partes: Prisma.Sql[] = [Prisma.sql`"sucursal"::text = ${sucursal}`, Prisma.sql`"asesor" = ${asesor}`];
  if (f.desde) partes.push(Prisma.sql`"fecha"::date >= ${f.desde}::date`);
  if (f.hasta) partes.push(Prisma.sql`"fecha"::date <= ${f.hasta}::date`);
  if (f.soloAbiertos) partes.push(Prisma.sql`"estado"::text NOT IN ('VENTA', 'PERDIDO')`);
  return Prisma.join(partes, " AND ");
}
