"use client";

import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 400;

/**
 * Buscador de leads. Busca mientras escribes (o con Enter / "Buscar"), sin importar mayúsculas ni acentos,
 * por nombre, teléfono, interés, asesor o folio. Varias palabras = todas deben aparecer.
 */
export function LeadSearchBox({
  value,
  onSearch,
  enPeriodo,
  onEnPeriodoChange,
}: {
  value: string;
  onSearch: (q: string) => void;
  enPeriodo: boolean;
  onEnPeriodoChange: (v: boolean) => void;
}) {
  const [draft, setDraft] = useState(value);
  const lastSent = useRef(value);
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  // Si la búsqueda se quita desde fuera (la etiqueta de filtros activos o "Limpiar filtros"), el cuadro se vacía también.
  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value;
      setDraft(value);
    }
  }, [value]);

  // Búsqueda automática al dejar de escribir (mínimo 2 caracteres; vacío = quitar búsqueda).
  useEffect(() => {
    const q = draft.trim();
    if (q === lastSent.current) return;
    if (q.length === 1) return;
    const t = setTimeout(() => {
      lastSent.current = q;
      onSearchRef.current(q);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft]);

  function submit() {
    const q = draft.trim();
    lastSent.current = q;
    onSearch(q);
  }

  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-auto">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 sm:flex-none">
          <label htmlFor="lead-search" className="mb-1 block text-xs font-medium text-slate-500">
            Buscar lead
          </label>
          <input
            id="lead-search"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Nombre, teléfono, interés, asesor o folio…"
            autoComplete="off"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:w-72"
          />
        </div>
        <button type="button" onClick={submit} className="rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark">
          Buscar
        </button>
        {(value || draft) && (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              lastSent.current = "";
              onSearch("");
            }}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Limpiar
          </button>
        )}
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={enPeriodo} onChange={(e) => onEnPeriodoChange(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-brand)]" />
        Buscar solo dentro del periodo elegido
      </label>
    </div>
  );
}
