"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { Fuente, Role, Sucursal } from "@prisma/client";
import { useToast } from "@/components/ui/Toast";
import { FUENTE_LABELS, SUCURSAL_LABELS } from "@/lib/catalogs";
import { AsignarDialog, type AsignarLead } from "@/components/leads/AsignarDialog";

type Item = { id: string; nombre: string; telefono: string; interes: string; sucursal: Sucursal; fuente: Fuente; asesor?: string | null; createdAt: string; atrasado: boolean };
type PorSucursal = { sucursal: Sucursal; total: number; atrasados: number };
type Venta = { id: string; nombre: string; sucursal: Sucursal; monto: string | null; folioFactura: string | null; cerradaAt: string };
type Data = { total: number; atrasados: number; items: Item[]; porSucursal?: PorSucursal[]; ventas?: Venta[] };

const POLL_MS = 60_000;
const money = (v: string | null) => (v == null ? "" : "$" + Math.round(Number(v)).toLocaleString("es-MX"));

function hace(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

const seenKey = (username: string) => `crm:ventas-vistas:${username}`;
const leidosKey = (username: string) => `crm:avisos-leidos:${username}`; // cuántos leads sin atender ya se marcaron como leídos

/**
 * Campana de avisos. Se actualiza sola cada minuto. "Marcar todo como leído" apaga el número rojo de la campana
 * (se guarda en el navegador de cada persona); los leads siguen pendientes en Leads e Inicio y el número
 * vuelve a subir solo cuando llega algo nuevo.
 *  - Gerente: sus leads nuevos por atender, uno por uno.
 *  - Coordinación: cuántos leads sin atender hay en cada sucursal + ventas cerradas recientes.
 */
export function AvisosBell({ role, username }: { role: Role; username: string }) {
  const router = useRouter();
  const coord = role === "coord";
  const { toast, toastNode } = useToast();
  const boxRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);
  const seenSales = useRef<Set<string> | null>(null);
  const [open, setOpen] = useState(false);
  const [asignando, setAsignando] = useState<AsignarLead | null>(null);
  const [data, setData] = useState<Data>({ total: 0, atrasados: 0, items: [] });
  // Hora (ms) hasta la que Coordinación ya vio las ventas cerradas. Se guarda en su navegador.
  const [vistasHasta, setVistasHasta] = useState<number>(() => Date.now());
  // Cuántos de los leads sin atender actuales ya se marcaron como leídos.
  const [leidos, setLeidos] = useState(0);
  const guardarLeidos = useCallback(
    (n: number) => {
      try {
        localStorage.setItem(leidosKey(username), String(n));
      } catch {
        /* sin almacenamiento */
      }
    },
    [username]
  );

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
      if (d.ventas) {
        if (seenSales.current) {
          const nuevas = d.ventas.filter((v) => !seenSales.current!.has(v.id));
          if (nuevas.length === 1) toast(`💰 Venta cerrada: ${nuevas[0].nombre}${nuevas[0].monto ? " · " + money(nuevas[0].monto) : ""} (${SUCURSAL_LABELS[nuevas[0].sucursal]})`);
          else if (nuevas.length > 1) toast(`💰 Se cerraron ${nuevas.length} ventas`);
        }
        seenSales.current = new Set(d.ventas.map((v) => v.id));
      }
      setData(d);
      // Si se atendieron leads, lo "leído" no puede ser mayor que lo que hay (así lo nuevo siempre cuenta).
      setLeidos((prev) => {
        const n = Math.min(prev, d.total);
        if (n !== prev) guardarLeidos(n);
        return n;
      });
    } catch {
      /* sin red: se reintenta en el siguiente ciclo */
    }
  }, [toast, guardarLeidos]);

  useEffect(() => {
    try {
      const n = Number(localStorage.getItem(leidosKey(username)) ?? 0);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia guardada en el navegador (solo cliente)
      if (Number.isFinite(n) && n > 0) setLeidos(n);
    } catch {
      /* sin almacenamiento */
    }
    if (coord) {
      try {
        const saved = localStorage.getItem(seenKey(username));
        if (saved) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia guardada en el navegador (solo cliente)
          setVistasHasta(Number(saved));
        } else {
          localStorage.setItem(seenKey(username), String(Date.now())); // primera vez: lo anterior no cuenta como nuevo
        }
      } catch {
        /* sin almacenamiento */
      }
    }
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load, coord, username]);

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

  const ventasNuevas = coord ? (data.ventas ?? []).filter((v) => new Date(v.cerradaAt).getTime() > vistasHasta).length : 0;
  const sinLeer = Math.max(0, data.total - leidos);
  const badge = sinLeer + ventasNuevas;
  const rojo = (sinLeer > 0 && data.atrasados > 0) || ventasNuevas > 0;

  function markSalesSeen() {
    const latest = Math.max(Date.now(), ...(data.ventas ?? []).map((v) => new Date(v.cerradaAt).getTime()));
    setVistasHasta(latest);
    try {
      localStorage.setItem(seenKey(username), String(latest));
    } catch {
      /* ignorar */
    }
  }

  function marcarTodoLeido() {
    setLeidos(data.total);
    guardarLeidos(data.total);
    if (coord) markSalesSeen();
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        aria-label={`Avisos: ${badge === 0 ? "todo leído" : `${badge} sin leer`}; ${data.total} leads sin atender${data.atrasados ? `, ${data.atrasados} con más de 24 h` : ""}${ventasNuevas ? `, ${ventasNuevas} ventas cerradas nuevas` : ""}`}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {badge > 0 && (
          <span className={clsx("absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white", rojo ? "bg-brand" : "bg-slate-500")}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-2 top-16 z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-96">
          <div className="max-h-[70vh] overflow-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
              <span className="text-xs text-slate-500">{badge > 0 ? `${badge} sin leer` : "Todo leído"}</span>
              {badge > 0 && (
                <button onClick={marcarTodoLeido} className="min-h-8 rounded-md px-2 text-xs font-semibold text-brand hover:bg-red-50">
                  Marcar todo como leído
                </button>
              )}
            </div>
            {coord ? (
              <>
                {/* Leads sin atender, por sucursal */}
                <div className="border-b border-slate-100 px-4 py-2.5">
                  <p className="text-sm font-semibold text-slate-900">Leads sin atender por sucursal</p>
                  <p className="text-xs text-slate-500">
                    {data.total === 0 ? "Todo atendido por ahora." : `${data.total} en total${data.atrasados ? ` · ${data.atrasados} con más de 24 h` : ""}`}
                  </p>
                </div>
                {(data.porSucursal ?? []).length === 0 ? (
                  <p className="px-4 py-5 text-center text-sm text-slate-400">No hay leads sin atender.</p>
                ) : (
                  (data.porSucursal ?? []).map((s) => (
                    <button
                      key={s.sucursal}
                      onClick={() => {
                        setOpen(false);
                        router.push(`/leads?sucursal=${s.sucursal}`);
                      }}
                      className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left hover:bg-slate-50"
                    >
                      <span className="text-sm font-medium text-slate-800">{SUCURSAL_LABELS[s.sucursal]}</span>
                      <span className="text-right text-sm">
                        <span className="font-bold text-slate-900">
                          {s.total} <span className="font-normal text-slate-500">sin atender</span>
                        </span>
                        {s.atrasados > 0 && <span className="block text-[11px] font-semibold text-red-600">{s.atrasados} con más de 24 h</span>}
                      </span>
                    </button>
                  ))
                )}

                {/* Ventas cerradas */}
                <div className="border-b border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                  <p className="text-sm font-semibold text-slate-900">Ventas cerradas recientes</p>
                  <p className="text-xs text-slate-500">Este mes</p>
                </div>
                {(data.ventas ?? []).length === 0 ? (
                  <p className="px-4 py-5 text-center text-sm text-slate-400">Aún no hay ventas cerradas este mes.</p>
                ) : (
                  (data.ventas ?? []).map((v) => {
                    const nueva = new Date(v.cerradaAt).getTime() > vistasHasta;
                    return (
                      <button
                        key={v.id}
                        onClick={() => {
                          setOpen(false);
                          router.push(`/leads?editar=${v.id}`);
                        }}
                        className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                            {nueva && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Nueva" />}
                            <span className="truncate">{v.nombre}</span>
                          </span>
                          <span className="block text-xs text-slate-500">
                            {SUCURSAL_LABELS[v.sucursal]}
                            {v.folioFactura ? ` · ${v.folioFactura}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-bold text-green-700">{money(v.monto) || "Venta"}</span>
                          <span className="block text-[11px] text-slate-400">hace {hace(v.cerradaAt)}</span>
                        </span>
                      </button>
                    );
                  })
                )}
              </>
            ) : (
              <>
                <div className="border-b border-slate-100 px-4 py-2.5">
                  <p className="text-sm font-semibold text-slate-900">Leads nuevos por atender</p>
                  <p className="text-xs text-slate-500">
                    {data.total === 0 ? "Todo atendido por ahora." : `${data.total} en total${data.atrasados ? ` · ${data.atrasados} con más de 24 h sin atender` : ""}`}
                  </p>
                </div>
                {data.items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">No hay leads nuevos pendientes.</p>
                ) : (
                  data.items.map((n) => (
                    <div key={n.id} className="flex items-stretch border-b border-slate-100 last:border-0">
                      <button
                        onClick={() => {
                          setOpen(false);
                          router.push(`/leads?editar=${n.id}`);
                        }}
                        className="flex min-w-0 flex-1 items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900">{n.nombre}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {n.telefono}
                            {n.interes ? ` · ${n.interes}` : ""}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-400">
                            {FUENTE_LABELS[n.fuente]}
                            {n.asesor ? ` · Asesor: ${n.asesor.split(" ")[0]}` : ""}
                          </span>
                        </span>
                        <span className={clsx("shrink-0 text-xs", n.atrasado ? "font-semibold text-red-600" : "text-slate-400")}>
                          hace {hace(n.createdAt)}
                          {n.atrasado && <span className="block">sin atender</span>}
                        </span>
                      </button>
                      {!n.asesor && (
                        <button
                          onClick={() => {
                            setOpen(false);
                            setAsignando({ id: n.id, nombre: n.nombre, interes: n.interes, sucursal: n.sucursal, estado: "NUEVO", asesor: null });
                          }}
                          className="m-2 shrink-0 self-center rounded-md bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
                        >
                          Asignar
                        </button>
                      )}
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}
      <AsignarDialog
        lead={asignando}
        onClose={() => setAsignando(null)}
        onDone={(r) => {
          toast(`✓ ${asignando?.nombre ?? "Lead"} → ${r.asesor}`);
          setAsignando(null);
          void load();
          router.refresh();
        }}
      />
      {toastNode}
    </div>
  );
}
