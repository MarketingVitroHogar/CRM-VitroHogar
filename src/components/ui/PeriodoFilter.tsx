"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  PERIODOS_EXTRA,
  PERIODOS_RAPIDOS,
  rangoDe,
  textoRango,
  toDateStr,
  type PeriodoKey,
  type PeriodoState,
} from "@/lib/periodos";

const inputCls = "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

/**
 * Filtro de periodo: Hoy · Ayer · Esta semana · Este mes · Personalizado, y "Más periodos" para el resto.
 * Se usa igual en Leads y en Reportes.
 */
export function PeriodoFilter({
  value,
  onChange,
  label = "Periodo",
}: {
  value: PeriodoState;
  onChange: (next: PeriodoState) => void;
  label?: string;
}) {
  const hoy = toDateStr(new Date());
  const [draftFrom, setDraftFrom] = useState(value.from || hoy);
  const [draftTo, setDraftTo] = useState(value.to || hoy);
  // "Personalizado" se muestra abierto aunque aún no se haya aplicado.
  const [abrirPersonalizado, setAbrirPersonalizado] = useState(value.key === "personalizado");

  const esExtra = PERIODOS_EXTRA.some((p) => p.key === value.key);
  const personalizadoActivo = value.key === "personalizado" || abrirPersonalizado;

  function pick(key: PeriodoKey) {
    setAbrirPersonalizado(false);
    onChange({ key, from: "", to: "" });
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
          {PERIODOS_RAPIDOS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => pick(p.key)}
              aria-pressed={value.key === p.key && !abrirPersonalizado}
              className={clsx(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition",
                value.key === p.key && !abrirPersonalizado ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAbrirPersonalizado(true)}
            aria-pressed={personalizadoActivo}
            className={clsx(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition",
              personalizadoActivo ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            Personalizado
          </button>
          <select
            aria-label="Más periodos"
            value={esExtra && !abrirPersonalizado ? value.key : ""}
            onChange={(e) => e.target.value && pick(e.target.value as PeriodoKey)}
            className={clsx(inputCls, esExtra && !abrirPersonalizado && "border-brand font-medium text-brand")}
          >
            <option value="">Más periodos…</option>
            {PERIODOS_EXTRA.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {personalizadoActivo && (
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">Desde</span>
            <input type="date" value={draftFrom} max={draftTo} onChange={(e) => setDraftFrom(e.target.value)} className={inputCls} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">Hasta</span>
            <input type="date" value={draftTo} min={draftFrom} onChange={(e) => setDraftTo(e.target.value)} className={inputCls} />
          </label>
          <button
            type="button"
            disabled={!draftFrom || !draftTo}
            onClick={() => {
              onChange({ key: "personalizado", from: draftFrom, to: draftTo });
              setAbrirPersonalizado(false);
            }}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Mostrando: <span className="font-medium text-slate-700">{textoRango(rangoDe(value))}</span>
      </p>
    </div>
  );
}
