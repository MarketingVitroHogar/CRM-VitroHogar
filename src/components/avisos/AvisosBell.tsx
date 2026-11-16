"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { Fuente, Sucursal } from "@prisma/client";
import { useToast } from "@/components/ui/Toast";
import { FUENTE_LABELS, SUCURSAL_LABELS } from "@/lib/catalogs";

type Item = { id: string; nombre: string; telefono: string; interes: string; sucursal: Sucursal; fuente: Fuente; createdAt: string; atrasado: boolean };
type Data = { total: number; atrasados: number; items: Item[] };

const POLL_MS = 60_000;

function hace(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

/** Campana: leads nuevos por atender. Se actualiza sola cada minuto y avisa cuando llega uno nuevo. */
export function AvisosBell({ showSucursal }: { showSucursal: boolean }) {
  const router = useRouter();
  const { toast, toastNode } = useToast();
  const boxRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data>({ total: 0, atrasados: 0, items: [] });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/avisos", { cache: "no-store" });
      if (!res.ok) return;
      const d: Data = await res.json();
      if (seen.current) {
        const nuevos = d.items.filter((i) => !seen.current!.has(i.id));
        if (nuevos.length === 1) toast(`🔔 Llegó un lead nuevo: ${nuevos[0].nombre}`);
        else if (nuevos.length > 1) toast(`🔔 Llegaron ${nuevos.length} leads nuevos`);
      }
      seen.current = new Set(d.items.map((i) => i.id));
      setData(d);
    } catch {
      /* sin red: se reintenta en el siguiente ciclo */
    }
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al montar
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        aria-label={`Leads nuevos por atender: ${data.total}${data.atrasados ? `, ${data.atrasados} atrasados` : ""}`}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {data.total > 0 && (
          <span className={clsx("absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white", data.atrasados > 0 ? "bg-brand" : "bg-slate-500")}>
            {data.total > 99 ? "99+" : data.total}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-2 top-16 z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-96">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Leads nuevos por atender</p>
            <p className="text-xs text-slate-500">
              {data.total === 0 ? "Todo atendido por ahora." : `${data.total} en total${data.atrasados ? ` · ${data.atrasados} con más de 24 h sin atender` : ""}`}
            </p>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            {data.items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No hay leads nuevos pendientes.</p>
            ) : (
              data.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/leads/${n.id}`);
                  }}
                  className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">{n.nombre}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {n.telefono}
                      {n.interes ? ` · ${n.interes}` : ""}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">
                      {FUENTE_LABELS[n.fuente]}
                      {showSucursal ? ` · ${SUCURSAL_LABELS[n.sucursal]}` : ""}
                    </span>
                  </span>
                  <span className={clsx("shrink-0 text-xs", n.atrasado ? "font-semibold text-red-600" : "text-slate-400")}>
                    hace {hace(n.createdAt)}
                    {n.atrasado && <span className="block">sin atender</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {toastNode}
    </div>
  );
}
