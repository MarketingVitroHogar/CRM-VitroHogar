import type { Estado } from "@prisma/client";

/**
 * Columnas del Kanban. Cada columna agrupa uno o más estados reales del lead
 * (el estado exacto se sigue guardando y mostrando igual en la ficha).
 *  - Contactado incluye "No respondió"
 *  - Cotización incluye "Seguimiento"
 */
export type KanbanColumn = {
  key: string;
  label: string;
  dot: string; // clase Tailwind del punto de color
  /** Estado que se guarda al soltar una tarjeta en esta columna. */
  target: Estado;
  estados: Estado[];
};

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { key: "NUEVO", label: "Nuevo", dot: "bg-slate-400", target: "NUEVO", estados: ["NUEVO"] },
  { key: "CONTACTADO", label: "Contactado", dot: "bg-blue-500", target: "CONTACTADO", estados: ["CONTACTADO", "NO_RESPONDIO"] },
  { key: "COTIZACION", label: "Cotización", dot: "bg-amber-500", target: "COTIZACION", estados: ["COTIZACION", "SEGUIMIENTO"] },
  { key: "VENTA", label: "Venta", dot: "bg-green-500", target: "VENTA", estados: ["VENTA"] },
  { key: "PERDIDO", label: "Perdido", dot: "bg-red-500", target: "PERDIDO", estados: ["PERDIDO"] },
];

export function columnOf(estado: Estado): KanbanColumn {
  return KANBAN_COLUMNS.find((c) => c.estados.includes(estado)) ?? KANBAN_COLUMNS[0];
}

export type LeadsVista = "kanban" | "lista" | "tarjetas";
export const VISTA_STORAGE_KEY = "crm:leads-vista";
