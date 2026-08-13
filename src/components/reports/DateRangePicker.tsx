"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export type DateRangeValue = { from: string; to: string } | null; // null = "todo el tiempo"

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Deliberately plain browser-local date math — this range is what the coord
// (in Mexico) sees as "this week"/"today" on their own screen, not something
// read back against a stored UTC-anchored field. It gets sent to the API as
// plain YYYY-MM-DD strings and interpreted there via dayRangeUTC.
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateStr(dt);
}

function todayStr(): string {
  return toDateStr(new Date());
}

// Lunes = inicio de semana.
function mondayOffset(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay(); // 0=Dom..6=Sáb
  return day === 0 ? 6 : day - 1;
}

function startOfMonthStr(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return `${y}-${pad(m)}-01`;
}

const CUSTOM_LABEL = "Personalizado…";

type Preset = { label: string; range: () => DateRangeValue };

function buildPresets(): Preset[] {
  const today = todayStr();
  return [
    { label: "Hoy", range: () => ({ from: today, to: today }) },
    { label: "Ayer", range: () => ({ from: addDays(today, -1), to: addDays(today, -1) }) },
    {
      label: "Esta semana",
      range: () => ({ from: addDays(today, -mondayOffset(today)), to: today }),
    },
    {
      label: "Semana pasada",
      range: () => {
        const thisMonday = addDays(today, -mondayOffset(today));
        const lastSunday = addDays(thisMonday, -1);
        const lastMonday = addDays(lastSunday, -6);
        return { from: lastMonday, to: lastSunday };
      },
    },
    { label: "Últimos 7 días", range: () => ({ from: addDays(today, -6), to: today }) },
    { label: "Últimos 14 días", range: () => ({ from: addDays(today, -13), to: today }) },
    { label: "Últimos 30 días", range: () => ({ from: addDays(today, -29), to: today }) },
    { label: "Este mes", range: () => ({ from: startOfMonthStr(today), to: today }) },
    {
      label: "Mes pasado",
      range: () => {
        const lastDayPrevMonth = addDays(startOfMonthStr(today), -1);
        return { from: startOfMonthStr(lastDayPrevMonth), to: lastDayPrevMonth };
      },
    },
    { label: "Todo", range: () => null },
  ];
}

const PRESETS = buildPresets();

export function defaultDateRange(): DateRangeValue {
  return PRESETS.find((p) => p.label === "Este mes")!.range();
}

function formatRangeLabel(range: DateRangeValue): string {
  if (!range) return "Todo el tiempo";
  const fmt = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return format(new Date(y, m - 1, d), "d MMM yyyy", { locale: es });
  };
  return range.from === range.to ? fmt(range.from) : `${fmt(range.from)} – ${fmt(range.to)}`;
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}) {
  const [selectedLabel, setSelectedLabel] = useState("Este mes");
  const [customFrom, setCustomFrom] = useState(value?.from ?? todayStr());
  const [customTo, setCustomTo] = useState(value?.to ?? todayStr());

  function handleSelect(label: string) {
    setSelectedLabel(label);
    if (label === CUSTOM_LABEL) return; // esperar a que se pulse "Aplicar"
    const preset = PRESETS.find((p) => p.label === label);
    if (preset) onChange(preset.range());
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Periodo</label>
        <select
          value={selectedLabel}
          onChange={(e) => handleSelect(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          {PRESETS.map((p) => (
            <option key={p.label} value={p.label}>
              {p.label}
            </option>
          ))}
          <option value={CUSTOM_LABEL}>{CUSTOM_LABEL}</option>
        </select>
      </div>

      {selectedLabel === CUSTOM_LABEL && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Desde</label>
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Hasta</label>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange({ from: customFrom, to: customTo })}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Aplicar
          </button>
        </>
      )}

      <p className="text-sm text-slate-500">{formatRangeLabel(value)}</p>
    </div>
  );
}
