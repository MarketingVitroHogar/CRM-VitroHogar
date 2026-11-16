"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { Estado, Role } from "@prisma/client";
import { EstadoBadge } from "./EstadoBadge";
import { OverdueIndicator } from "./OverdueIndicator";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { FUENTE_LABELS, SUCURSAL_LABELS, ESTADO_LABELS, GERENTE_ALLOWED_ESTADOS, asesoresFor } from "@/lib/catalogs";
import { KANBAN_COLUMNS, columnOf } from "@/lib/kanban";
import { isOverdue } from "@/lib/leadPolicy";
import { formatDateOnly } from "@/lib/dateOnly";
import type { LeadDTO } from "@/lib/types";

const PER_COLUMN = 40; // tarjetas visibles por columna (el resto con "Mostrar más")

const money = (v: string | number | null) => (v == null ? "" : "$" + Math.round(Number(v)).toLocaleString("es-MX"));

// needsAsesor: el gerente mueve un lead que aún no tiene asesor → debe elegir uno.
type Pending = { lead: LeadDTO; target: Estado; needsAsesor: boolean } | null;

async function patchLead(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "No se pudo mover el lead");
  return data;
}

export function LeadsKanban({
  leads,
  role,
  setLeads,
  reload,
  onAssign,
}: {
  leads: LeadDTO[];
  role: Role;
  setLeads: React.Dispatch<React.SetStateAction<LeadDTO[]>>;
  reload: () => Promise<void>;
  onAssign: (lead: LeadDTO) => void;
}) {
  const { toast, toastNode } = useToast();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [monto, setMonto] = useState("");
  const [folio, setFolio] = useState("");
  const [asesor, setAsesor] = useState("");
  const [saving, setSaving] = useState(false);
  const [shown, setShown] = useState<Record<string, number>>({});

  const showSucursal = role === "coord";
  const canTo = (target: Estado) => role === "coord" || GERENTE_ALLOWED_ESTADOS.includes(target);

  async function apply(lead: LeadDTO, target: Estado, extra: Record<string, unknown> = {}) {
    const previous = leads;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, estado: target, ...(typeof extra.asesor === "string" ? { asesor: extra.asesor } : {}) } : l))); // se ve al instante
    try {
      await patchLead(lead.id, { estado: target, ...extra });
      toast(`${lead.nombre} → ${ESTADO_LABELS[target]}`);
      await reload();
    } catch (e) {
      setLeads(previous);
      toast(e instanceof Error ? e.message : "No se pudo mover el lead");
    }
  }

  function requestMove(lead: LeadDTO, target: Estado) {
    if (columnOf(lead.estado).target === target) return;
    if (!canTo(target)) {
      toast("Solo Coordinación puede regresar un lead a “Nuevo”.");
      return;
    }
    // El gerente debe indicar quién atiende el lead cuando todavía no tiene asesor
    // (si la sucursal aún no tiene asesores registrados, no se puede pedir).
    const needsAsesor = role === "gerente" && !lead.asesor && asesoresFor(lead.sucursal).length > 0;
    if (target === "VENTA" || needsAsesor) {
      setMonto("");
      setFolio("");
      setAsesor("");
      setPending({ lead, target, needsAsesor });
      return;
    }
    void apply(lead, target);
  }

  async function confirmMove(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    const extra: Record<string, unknown> = {};
    if (pending.needsAsesor) {
      if (!asesor) return toast("Elige el asesor que atiende este lead");
      extra.asesor = asesor;
    }
    if (pending.target === "VENTA") {
      if (monto.trim()) {
        const n = Number(monto.replace(/[$,\s]/g, ""));
        if (!Number.isFinite(n) || n < 0) return toast("Escribe un monto válido");
        extra.montoVenta = n;
      }
      if (folio.trim()) extra.folioFactura = folio.trim();
    }
    setSaving(true);
    const p = pending;
    setPending(null);
    await apply(p.lead, p.target, extra);
    setSaving(false);
  }

  return (
    <div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0" role="list" aria-label="Tablero de leads por estado">
        {KANBAN_COLUMNS.map((col) => {
          const items = leads.filter((l) => col.estados.includes(l.estado));
          const limit = shown[col.key] ?? PER_COLUMN;
          const total = items.reduce((s, l) => s + (l.montoVenta ? Number(l.montoVenta) : 0), 0);
          return (
            <section
              key={col.key}
              role="listitem"
              aria-label={`${col.label}: ${items.length}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.key);
              }}
              onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOverCol(null);
                const lead = leads.find((l) => l.id === (dragId ?? e.dataTransfer.getData("text/plain")));
                setDragId(null);
                if (lead) requestMove(lead, col.target);
              }}
              className={clsx(
                "flex max-h-[calc(100vh-17rem)] min-h-44 w-[82vw] shrink-0 snap-start flex-col rounded-xl bg-slate-100 sm:w-72 xl:min-w-0 xl:flex-1",
                overCol === col.key && "ring-2 ring-brand"
              )}
            >
              <header className="px-3 pb-2 pt-3">
                <div className="flex items-center gap-2">
                  <span className={clsx("h-2.5 w-2.5 rounded-full", col.dot)} aria-hidden />
                  <h2 className="text-sm font-bold text-slate-800">{col.label}</h2>
                  <span className="rounded-full bg-white px-2 text-xs font-semibold text-slate-600">{items.length}</span>
                </div>
                <p className="mt-0.5 min-h-4 text-xs text-slate-500">{col.key === "VENTA" && total > 0 ? `${money(total)} vendidos` : ""}</p>
              </header>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
                {items.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                    {col.key === "NUEVO" ? "Los leads nuevos aparecen aquí." : "Arrastra un lead hasta aquí."}
                  </p>
                )}
                {items.slice(0, limit).map((l) => {
                  const late = isOverdue({ estado: l.estado, proximoSeguimiento: l.proximoSeguimiento ? new Date(l.proximoSeguimiento) : null, createdAt: new Date(l.createdAt) });
                  return (
                    <article
                      key={l.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", l.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(l.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                      }}
                      className={clsx(
                        "cursor-grab rounded-lg border bg-white p-3 shadow-sm active:cursor-grabbing",
                        late ? "border-red-200" : "border-slate-200 hover:border-slate-300",
                        dragId === l.id && "opacity-40"
                      )}
                    >
                      <Link href={`/leads/${l.id}`} className="block">
                        <h3 className="truncate text-sm font-bold leading-snug text-slate-900" title={l.nombre}>
                          {l.nombre}
                        </h3>
                        <p className="truncate text-xs text-slate-500">{l.telefono}</p>
                        <p className="mt-1.5 line-clamp-2 text-xs text-slate-600">{l.interes || "—"}</p>
                        {l.montoVenta && <p className="mt-1.5 text-sm font-bold text-green-700">{money(l.montoVenta)}</p>}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{FUENTE_LABELS[l.fuente]}</span>
                        {showSucursal && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{SUCURSAL_LABELS[l.sucursal]}</span>}
                        {(l.estado === "NO_RESPONDIO" || l.estado === "SEGUIMIENTO") && <EstadoBadge estado={l.estado} />}
                      </div>
                      {late && (
                        <div className="mt-2">
                          <OverdueIndicator />
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                        <span>{l.proximoSeguimiento && !["VENTA", "PERDIDO"].includes(l.estado) ? `Seguimiento: ${formatDateOnly(l.proximoSeguimiento, "d MMM")}` : `Ingreso: ${formatDateOnly(l.fecha, "d MMM")}`}</span>
                        {l.asesor ? (
                          <span className="truncate" title={l.asesor}>
                            {l.asesor.split(" ").slice(0, 2).join(" ")}
                          </span>
                        ) : l.estado === "VENTA" || l.estado === "PERDIDO" ? (
                          <span>Sin asesor</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAssign(l)}
                            className="min-h-8 shrink-0 rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-dark"
                          >
                            Asignar asesor
                          </button>
                        )}
                      </div>
                      {/* En celular no se arrastra bien: selector grande para mover de columna. */}
                      <label className="mt-2 block md:hidden">
                        <span className="sr-only">Mover {l.nombre} a otro estado</span>
                        <select
                          value={col.target}
                          onChange={(e) => requestMove(l, e.target.value as Estado)}
                          className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-2.5 text-sm text-slate-800"
                        >
                          {KANBAN_COLUMNS.filter((c) => canTo(c.target) || c.key === col.key).map((c) => (
                            <option key={c.key} value={c.target}>
                              Mover a: {c.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </article>
                  );
                })}
                {items.length > limit && (
                  <button onClick={() => setShown((s) => ({ ...s, [col.key]: limit + PER_COLUMN }))} className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    Mostrar más ({items.length - limit})
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending?.target === "VENTA" ? "Marcar como Venta" : `Mover a ${pending ? ESTADO_LABELS[pending.target] : ""}`}
      >
        <form onSubmit={confirmMove} className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            {pending?.lead.nombre} · {pending?.lead.interes}
          </p>
          {pending?.needsAsesor && (
            <div>
              <label htmlFor="k-asesor" className="mb-1 block text-sm font-medium text-slate-700">
                Asesor que atiende este lead
              </label>
              <select
                id="k-asesor"
                value={asesor}
                onChange={(e) => setAsesor(e.target.value)}
                required
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="">Elige un asesor…</option>
                {asesoresFor(pending.lead.sucursal).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">Este lead aún no tiene asesor asignado.</p>
            </div>
          )}
          {pending?.target === "VENTA" && (
            <>
              <div>
                <label htmlFor="k-monto" className="mb-1 block text-sm font-medium text-slate-700">
                  Monto de venta (MXN)
                </label>
                <input id="k-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Ej. 18500" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
              </div>
              <div>
                <label htmlFor="k-folio" className="mb-1 block text-sm font-medium text-slate-700">
                  Folio de factura
                </label>
                <input id="k-folio" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Ej. FAC-8801" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
              </div>
              <p className="-mt-2 text-xs text-slate-500">Puedes dejar el monto y el folio vacíos y completarlos después al editar el lead.</p>
            </>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPending(null)} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
              {pending?.target === "VENTA" ? "Guardar venta" : "Mover lead"}
            </button>
          </div>
        </form>
      </Modal>
      {toastNode}
    </div>
  );
}
