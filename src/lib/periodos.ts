// Periodos de fechas compartidos por Leads y Reportes (hoy, ayer, esta semana, este mes, personalizado…).
// Es matemática de fechas del navegador: lo que la persona (en México) ve como "hoy" en su pantalla.
// El rango viaja al servidor como "YYYY-MM-DD" y allá se interpreta con dayRangeUTC.

export type PeriodoKey =
  | "hoy"
  | "ayer"
  | "semana"
  | "mes"
  | "personalizado"
  | "semana_pasada"
  | "ultimos7"
  | "ultimos14"
  | "ultimos30"
  | "mes_pasado"
  | "todo";

/** from/to solo se usan con key "personalizado". */
export type PeriodoState = { key: PeriodoKey; from: string; to: string };

/** null = todo el tiempo. */
export type RangoFechas = { from: string; to: string } | null;

export const PERIODO_POR_DEFECTO: PeriodoState = { key: "mes", from: "", to: "" };

/** Los que se muestran como botones. */
export const PERIODOS_RAPIDOS: { key: PeriodoKey; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
];

/** Los que van en "Más periodos". */
export const PERIODOS_EXTRA: { key: PeriodoKey; label: string }[] = [
  { key: "semana_pasada", label: "Semana pasada" },
  { key: "ultimos7", label: "Últimos 7 días" },
  { key: "ultimos14", label: "Últimos 14 días" },
  { key: "ultimos30", label: "Últimos 30 días" },
  { key: "mes_pasado", label: "Mes pasado" },
  { key: "todo", label: "Todo el tiempo" },
];

const pad = (n: number) => String(n).padStart(2, "0");
export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isDateStr = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateStr(dt);
}

// La semana empieza en lunes.
function mondayOffset(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay(); // 0 = domingo
  return day === 0 ? 6 : day - 1;
}

function startOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return `${y}-${pad(m)}-01`;
}

/** Rango "YYYY-MM-DD" (ambos incluidos) de un periodo. Se calcula al momento: "hoy" siempre es el día actual. */
export function rangoDe(p: PeriodoState, hoy: string = toDateStr(new Date())): RangoFechas {
  switch (p.key) {
    case "hoy":
      return { from: hoy, to: hoy };
    case "ayer": {
      const a = addDays(hoy, -1);
      return { from: a, to: a };
    }
    case "semana":
      return { from: addDays(hoy, -mondayOffset(hoy)), to: hoy };
    case "semana_pasada": {
      const lunes = addDays(hoy, -mondayOffset(hoy));
      return { from: addDays(lunes, -7), to: addDays(lunes, -1) };
    }
    case "ultimos7":
      return { from: addDays(hoy, -6), to: hoy };
    case "ultimos14":
      return { from: addDays(hoy, -13), to: hoy };
    case "ultimos30":
      return { from: addDays(hoy, -29), to: hoy };
    case "mes":
      return { from: startOfMonth(hoy), to: hoy };
    case "mes_pasado": {
      const ultimo = addDays(startOfMonth(hoy), -1);
      return { from: startOfMonth(ultimo), to: ultimo };
    }
    case "personalizado":
      if (isDateStr(p.from) && isDateStr(p.to)) return p.from <= p.to ? { from: p.from, to: p.to } : { from: p.to, to: p.from };
      return { from: startOfMonth(hoy), to: hoy };
    case "todo":
      return null;
  }
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmt(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}

/** Texto legible del rango, p. ej. "16 nov 2026" o "10 nov 2026 – 16 nov 2026". */
export function textoRango(r: RangoFechas): string {
  if (!r) return "Todo el tiempo";
  return r.from === r.to ? fmt(r.from) : `${fmt(r.from)} – ${fmt(r.to)}`;
}

/** Interpreta ?periodo=... de una dirección (p. ej. desde la campana). Valores desconocidos → null. */
export function periodoDeUrl(valor: string | null): PeriodoState | null {
  if (valor === "todos" || valor === "todo") return { key: "todo", from: "", to: "" };
  const k = [...PERIODOS_RAPIDOS, ...PERIODOS_EXTRA].find((p) => p.key === valor);
  return k ? { key: k.key, from: "", to: "" } : null;
}
