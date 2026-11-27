"use client";

import { useState } from "react";
import Link from "next/link";
import type { Estado, Sucursal } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { SUCURSAL_LABELS } from "@/lib/catalogs";
import { useAsesoresFor } from "@/components/AsesoresProvider";

/** Lo mínimo de un lead para poder asignarle asesor (sirve para la lista, el Kanban y la campana). */
export type AsignarLead = { id: string; nombre: string; interes: string; sucursal: Sucursal; estado: Estado; asesor?: string | null };

export type AsignarResult = { id: string; asesor: string; estado?: Estado };

/** Aviso global: cualquier pantalla que muestre leads se recarga cuando alguien asigna uno. */
export const LEADS_CHANGED_EVENT = "crm:leads-changed";

/**
 * Asignar asesor en un paso: elegir asesor → listo.
 * Opcional: pasar el lead de "Nuevo" a "Contactado" al mismo tiempo.
 */
export function AsignarDialog({
  lead,
  onClose,
  onDone,
}: {
  lead: AsignarLead | null;
  onClose: () => void;
  onDone: (r: AsignarResult) => void;
}) {
  const [asesor, setAsesor] = useState("");
  const [contactado, setContactado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada vez que se abre para otro lead, el formulario empieza limpio.
  const [lastId, setLastId] = useState<string | null>(null);
  if (lead && lead.id !== lastId) {
    setLastId(lead.id);
    setAsesor(lead.asesor ?? "");
    setContactado(false);
    setError(null);
    setSaving(false);
  }
  if (!lead && lastId !== null) setLastId(null);

  const asesoresFor = useAsesoresFor();
  const roster = lead ? asesoresFor(lead.sucursal) : [];
  const puedeContactado = lead?.estado === "NUEVO";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    if (!asesor) return setError("Elige el asesor que atenderá este lead.");
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { asesor };
      if (puedeContactado && contactado) body.estado = "CONTACTADO";
      const res = await fetch(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo asignar el asesor.");
        setSaving(false);
        return;
      }
      setSaving(false);
      onDone({ id: lead.id, asesor, ...(body.estado ? { estado: body.estado as Estado } : {}) });
      try {
        window.dispatchEvent(new Event(LEADS_CHANGED_EVENT));
      } catch {
        /* ignorar */
      }
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setSaving(false);
    }
  }

  return (
    <Modal open={!!lead} onClose={onClose} title={lead?.asesor ? "Cambiar asesor" : "Asignar asesor"}>
      {lead && (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            <b className="text-slate-900">{lead.nombre}</b>
            {lead.interes ? ` · ${lead.interes}` : ""}
            <span className="block text-xs text-slate-400">{SUCURSAL_LABELS[lead.sucursal]}</span>
          </p>

          {roster.length === 0 ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Esta sucursal aún no tiene asesores registrados, por eso no se puede asignar desde aquí. Pide a Coordinación que los dé de alta.
            </p>
          ) : (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-slate-700">Asesor que atiende</legend>
              <div className="flex flex-col gap-1.5">
                {roster.map((a) => (
                  <label
                    key={a}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${asesor === a ? "border-brand bg-red-50 font-semibold text-slate-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                  >
                    <input type="radio" name="asesor" value={a} checked={asesor === a} onChange={() => setAsesor(a)} className="h-4 w-4 accent-brand" />
                    {a}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {puedeContactado && roster.length > 0 && (
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={contactado} onChange={(e) => setContactado(e.target.checked)} className="h-4 w-4" />
              Además, marcarlo como <b>Contactado</b>
            </label>
          )}

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/leads/${lead.id}`} className="text-xs font-medium text-slate-500 underline hover:text-slate-700">
              Abrir ficha completa
            </Link>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="min-h-10 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
                Cancelar
              </button>
              <button type="submit" disabled={saving || roster.length === 0} className="min-h-10 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
                {saving ? "Guardando…" : "Asignar"}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
