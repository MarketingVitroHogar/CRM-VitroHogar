import { normalizeText } from "@/lib/textMatch";

const FECHA_HINTS = ["fecha", "fecha ingreso", "fecha de ingreso", "fecha de registro"];
const NOMBRE_HINTS = ["nombre", "cliente", "nombre cliente", "nombre del cliente"];

const MAX_SCAN_ROWS = 20;

/**
 * Scans the first ~20 rows of a raw sheet (array-of-arrays) for the header
 * row: the first row containing at least one cell matching a "fecha" hint
 * AND at least one cell matching a "nombre/cliente" hint. Returns null if
 * no row in range qualifies — callers must surface this as an import error
 * rather than guessing a header row.
 */
export function detectHeaderRow(rows: unknown[][]): number | null {
  const limit = Math.min(rows.length, MAX_SCAN_ROWS);

  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (!row) continue;

    const normalizedCells = row.map((cell) => normalizeText(String(cell ?? "")));
    const hasFecha = normalizedCells.some((cell) => FECHA_HINTS.includes(cell));
    const hasNombre = normalizedCells.some((cell) => NOMBRE_HINTS.includes(cell));

    if (hasFecha && hasNombre) return i;
  }

  return null;
}
