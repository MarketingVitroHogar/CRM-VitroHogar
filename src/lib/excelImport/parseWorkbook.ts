import * as XLSX from "xlsx";
import type { Fuente, Sucursal } from "@prisma/client";
import { detectHeaderRow } from "./headerDetection";
import { mapColumns, matchFuente, matchSucursal, isTruthyFlag, type ColumnMapping } from "./columnMapping";

export class HeaderNotDetectedError extends Error {
  constructor() {
    super("No se detectó una fila de encabezados en las primeras 20 filas de esta hoja.");
  }
}

export function listSheetNames(buffer: Buffer): string[] {
  const workbook = XLSX.read(buffer, { bookSheets: true, type: "buffer" });
  return workbook.SheetNames;
}

function excelSerialToDate(serial: number): Date {
  // Excel's epoch is 1899-12-30 (accounts for the historical 1900 leap-year bug).
  const utcMs = Math.round((serial - 25569) * 86400 * 1000);
  const utcDate = new Date(utcMs);
  return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
}

/** Parses a date cell that may be a JS Date, an Excel serial number, or common dd/mm/yyyy or yyyy-mm-dd text. */
function parseFlexibleExcelDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    return excelSerialToDate(value);
  }
  if (typeof value !== "string") return null;

  const text = value.trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  // Mexican convention: dd/mm/yyyy (also accepts dd-mm-yyyy).
  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const [, d, m, yRaw] = slashMatch;
    const y = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
    const date = new Date(y, Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export type StagedRow = {
  rowIndex: number;
  fecha: string; // ISO date
  nombre: string;
  telefono: string;
  interes: string;
  fuente: Fuente;
  sucursal: Sucursal | null;
  sucursalRaw: string;
};

export type ExcludedRow = {
  rowIndex: number;
  reason: "sin-nombre" | "sin-fecha";
  rawNombre: string;
  rawFecha: string;
};

export type PreviewResult = {
  sheetName: string;
  headerRowIndex: number;
  columnMapping: ColumnMapping;
  ambiguousCanal: boolean;
  rows: StagedRow[];
  excluded: ExcludedRow[];
  countsByBranch: Partial<Record<Sucursal, number>>;
};

export function parseSheetForPreview(buffer: Buffer, sheetName: string): PreviewResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`La hoja "${sheetName}" no existe en este archivo.`);

  const aoa: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  const headerRowIndex = detectHeaderRow(aoa);
  if (headerRowIndex === null) throw new HeaderNotDetectedError();

  const headerRow = aoa[headerRowIndex];
  const columnMapping = mapColumns(headerRow);

  const hasFlagColumns = ["wa", "fb", "ig", "tt"].some((k) => columnMapping[k as keyof ColumnMapping] !== undefined);
  const hasCombinedCanal = columnMapping.fuenteCombinada !== undefined;
  const ambiguousCanal = hasFlagColumns && hasCombinedCanal;

  const rows: StagedRow[] = [];
  const excluded: ExcludedRow[] = [];
  const countsByBranch: Partial<Record<Sucursal, number>> = {};

  for (let i = headerRowIndex + 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row || row.every((cell) => cell === null || cell === "")) continue;

    const get = (field: keyof ColumnMapping) => {
      const idx = columnMapping[field];
      return idx === undefined ? null : row[idx];
    };

    const rawNombre = String(get("nombre") ?? "").trim();
    const rawFechaCell = get("fecha");
    const parsedFecha = parseFlexibleExcelDate(rawFechaCell);

    if (!rawNombre && !parsedFecha) continue; // blank/summary/subtotal row — silently skipped

    if (!rawNombre) {
      excluded.push({
        rowIndex: i,
        reason: "sin-nombre",
        rawNombre,
        rawFecha: String(rawFechaCell ?? ""),
      });
      continue;
    }
    if (!parsedFecha) {
      excluded.push({
        rowIndex: i,
        reason: "sin-fecha",
        rawNombre,
        rawFecha: String(rawFechaCell ?? ""),
      });
      continue;
    }

    const telefono = String(get("telefono") ?? "").trim();
    const interes = String(get("interes") ?? "").trim();

    // Channel: prefer separate WA/FB/IG/TT flag columns over a combined
    // canal/fuente text column when both are present (more explicit signal).
    let fuente: Fuente = "OTRO";
    if (hasFlagColumns) {
      if (isTruthyFlag(get("wa"))) fuente = "WHATSAPP";
      else if (isTruthyFlag(get("fb"))) fuente = "FACEBOOK";
      else if (isTruthyFlag(get("ig"))) fuente = "INSTAGRAM";
      else if (isTruthyFlag(get("tt"))) fuente = "TIKTOK";
    } else if (hasCombinedCanal) {
      const canalText = String(get("fuenteCombinada") ?? "");
      fuente = matchFuente(canalText) ?? "OTRO";
    }

    const sucursalRaw = String(get("sucursal") ?? "").trim();
    const sucursal = sucursalRaw ? matchSucursal(sucursalRaw) : null;

    if (sucursal) {
      countsByBranch[sucursal] = (countsByBranch[sucursal] ?? 0) + 1;
    }

    rows.push({
      rowIndex: i,
      fecha: parsedFecha.toISOString(),
      nombre: rawNombre,
      telefono,
      interes,
      fuente,
      sucursal,
      sucursalRaw,
    });
  }

  return { sheetName, headerRowIndex, columnMapping, ambiguousCanal, rows, excluded, countsByBranch };
}
