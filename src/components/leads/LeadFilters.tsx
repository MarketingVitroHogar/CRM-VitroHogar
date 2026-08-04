"use client";

import { SUCURSALES, SUCURSAL_LABELS, ESTADOS, ESTADO_LABELS } from "@/lib/catalogs";

export type LeadFilterState = {
  mes: string; // "" = todos, else "YYYY-MM"
  sucursal: string; // "" = todas
  estado: string; // "" = todos
  orden: "desc" | "asc"; // fecha: más reciente primero | más antigua primero
};

// El filtro de estado en la lista de leads no incluye "Perdido" — sigue
// siendo un estado válido para un lead (asignable desde el formulario), solo
// no aparece como opción para filtrar la vista principal.
const ESTADOS_FILTRABLES = ESTADOS.filter((e) => e !== "PERDIDO");

function recentMonthOptions(count = 12) {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

export function LeadFilters({
  value,
  onChange,
  showSucursal,
}: {
  value: LeadFilterState;
  onChange: (next: LeadFilterState) => void;
  showSucursal: boolean;
}) {
  const monthOptions = recentMonthOptions();

  return (
    <div className="flex flex-wrap gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Mes</label>
        <select
          value={value.mes}
          onChange={(e) => onChange({ ...value, mes: e.target.value })}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todos</option>
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

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

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
        <select
          value={value.estado}
          onChange={(e) => onChange({ ...value, estado: e.target.value })}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todos</option>
          {ESTADOS_FILTRABLES.map((e) => (
            <option key={e} value={e}>
              {ESTADO_LABELS[e]}
            </option>
          ))}
        </select>
      </div>

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
  );
}
