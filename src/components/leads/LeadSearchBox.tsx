"use client";

import { useState } from "react";

export function LeadSearchBox({
  value,
  onSearch,
}: {
  value: string;
  onSearch: (q: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  function submit() {
    onSearch(draft.trim());
  }

  return (
    <div className="flex items-end gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Buscar por nombre o teléfono</label>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Ej. Juan Pérez o 449..."
          className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={submit}
        className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
      >
        Buscar
      </button>
      {value && (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            onSearch("");
          }}
          className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
