"use client";

import { SUCURSALES, SUCURSAL_LABELS, ESTADOS, ESTADO_LABELS } from "@/lib/catalogs";
import { PeriodoFilter } from "@/components/ui/PeriodoFilter";
import type { PeriodoState } from "@/lib/periodos";

export type LeadFilterState = {
  periodo: PeriodoState; // Hoy, Ayer, Esta semana, Este mes, Personalizado… (por fecha de ingreso)
  sucursal: string; // "" = todas
  estado: string; // "" = todos
  orden: "desc" | "asc"; // fecha: más reciente primero | más antigua primero
  q: string; // búsqueda — por defecto ignora el periodo mientras está activa
  qEnPeriodo: boolean; // true = buscar solo dentro del periodo elegido
};

// El filtro de estado en la lista de leads no incluye "Perdido" — sigue
// siendo un estado válido para un lead (asignable desde el formulario), solo
// no aparece como opción para filtrar la vista principal.
const ESTADOS_FILTRABLES = ESTADOS.filter((e) => e !== "PERDIDO");

export function LeadFilters({
  value,
  onChange,
  showSucursal,
  showEstado = true,
  estadoReducido = false,
}: {
  value: LeadFilterState;
  onChange: (next: LeadFilterState) => void;
  showSucursal: boolean;
  /** En el Kanban las columnas ya son los estados, así que el filtro se oculta. */
  showEstado?: boolean;
  /** En el Kanban las columnas ya son los estados: el menú solo ofrece "Todos" y "Sin seguimiento". */
  estadoReducido?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <PeriodoFilter label="Fecha de ingreso" value={value.periodo} onChange={(periodo) => onChange({ ...value, periodo })} />

      <div className="flex flex-wrap gap-3">
        {showSucursal && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Sucursal</label>
            <select
              value={value.sucursal}
              onChange={(e) => onChange({ ...value, sucursal: e.target.value })}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Todas</option>
              {SUCURSALES.map((s) => (
                <option key={s} value={s}>
                  {SUCURSAL_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        )}

        {showEstado && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
            <select
              value={value.estado}
              onChange={(e) => onChange({ ...value, estado: e.target.value })}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Todos</option>
              <option value="SIN_SEGUIMIENTO">Sin seguimiento</option>
              {!estadoReducido &&
                ESTADOS_FILTRABLES.map((e) => (
                  <option key={e} value={e}>
                    {ESTADO_LABELS[e]}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordenar por fecha</label>
          <select
            value={value.orden}
            onChange={(e) => onChange({ ...value, orden: e.target.value as "desc" | "asc" })}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="desc">Más reciente primero</option>
            <option value="asc">Más antigua primero</option>
          </select>
        </div>
      </div>
    </div>
  );
}
