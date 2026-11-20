"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { Fuente, Role, Sucursal } from "@prisma/client";
import { useToast } from "@/components/ui/Toast";
import { FUENTE_LABELS, SUCURSAL_LABELS } from "@/lib/catalogs";
import { AsignarDialog, type AsignarLead } from "@/components/leads/AsignarDialog";
import { formatDateOnly } from "@/lib/dateOnly";
import { guardarPref, leerPref, notificar, pedirPermiso, permisoNotif, sonar, type AvisosPref, type PermisoNotif } from "@/lib/avisosPref";

type Item = { id: string; nombre: string; telefono: string; interes: string; sucursal: Sucursal; fuente: Fuente; asesor?: string | null; createdAt: string; atrasado: boolean };
type PorSucursal = { sucursal: Sucursal; total: number; atrasados: number };
type Venta = { id: string; nombre: string; sucursal: Sucursal; monto: string | null; folioFactura: string | null; cerradaAt: string };
type SegItem = { id: string; nombre: string; estado: string; sucursal: Sucursal; asesor: string | null; seguimiento: string; vencido: boolean };
type SegPorSuc = { sucursal: Sucursal; total: number; vencidos: number };
type Seguimientos = { total: number; vencidos: number; items?: SegItem[]; porSucursal?: SegPorSuc[] };
type Data = { total: number; atrasados: number; items: Item[]; porSucursal?: PorSucursal[]; ventas?: Venta[]; seguimientos?: Seguimientos };

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
const leidosSegKey = (username: string) => `crm:avisos-leidos-seg:${username}`; // ídem, seguimientos

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
  const prevPorSuc = useRef<Map<string, number> | null>(null);
  const prefRef = useRef<AvisosPref>({ notif: false, sonido: false });
  const [open, setOpen] = useState(false);
  const [asignando, setAsignando] = useState<AsignarLead | null>(null);
  const [data, setData] = useState<Data>({ total: 0, atrasados: 0, items: [] });
  // Hora (ms) hasta la que Coordinación ya vio las ventas cerradas. Se guarda en su navegador.
  const [vistasHasta, setVistasHasta] = useState<number>(() => Date.now());
  // Cuántos de los leads sin atender actuales ya se marcaron como leídos (y lo mismo para los seguimientos).
  const [leidos, setLeidos] = useState(0);
  const [leidosSeg, setLeidosSeg] = useState(0);
  // Avisos del navegador y sonido (preferencia de cada persona).
  const [pref, setPref] = useState<AvisosPref>({ notif: false, sonido: false });
  const [permiso, setPermiso] = useState<PermisoNotif>("default");
  useEffect(() => {
    prefRef.current = pref;
  });
  const avisar = useCallback((titulo: string, cuerpo: string) => {
    if (prefRef.current.sonido) sonar();
    if (prefRef.current.notif) notificar(titulo, cuerpo);
  }, []);
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
  const guardarLeidosSeg = useCallback(
    (n: number) => {
      try {
        localStorage.setItem(leidosSegKey(username), String(n));
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
        if (nuevos.length === 1) {
          toast(`🔔 Llegó un lead nuevo: ${nuevos[0].nombre}`);
          avisar("Lead nuevo", `${nuevos[0].nombre} · ${FUENTE_LABELS[nuevos[0].fuente]}`);
        } else if (nuevos.length > 1) {
          toast(`🔔 Llegaron ${nuevos.length} leads nuevos`);
          avisar("Leads nuevos", `Llegaron ${nuevos.length} leads nuevos`);
        }
      }
      seen.current = new Set(d.items.map((i) => i.id));
      // Coordinación no recibe la lista, solo los totales por sucursal: un aumento = llegaron leads nuevos.
      if (d.porSucursal) {
        const ahora = new Map(d.porSucursal.map((s) => [s.sucursal as string, s.total]));
        if (prevPorSuc.current) {
          const subieron = d.porSucursal.filter((s) => s.total > (prevPorSuc.current!.get(s.sucursal) ?? 0));
          if (subieron.length > 0) {
            const n = subieron.reduce((a, s) => a + s.total - (prevPorSuc.current!.get(s.sucursal) ?? 0), 0);
            const donde = subieron.map((s) => SUCURSAL_LABELS[s.sucursal]).join(", ");
            toast(`🔔 ${n === 1 ? "Llegó un lead nuevo" : `Llegaron ${n} leads nuevos`} (${donde})`);
            avisar(n === 1 ? "Lead nuevo" : "Leads nuevos", `${n === 1 ? "Llegó un lead nuevo" : `Llegaron ${n} leads nuevos`} en ${donde}`);
          }
        }
        prevPorSuc.current = ahora;
      }
      if (d.ventas) {
        if (seenSales.current) {
          const nuevas = d.ventas.filter((v) => !seenSales.current!.has(v.id));
          if (nuevas.length === 1) {
            const txt = `${nuevas[0].nombre}${nuevas[0].monto ? " · " + money(nuevas[0].monto) : ""} (${SUCURSAL_LABELS[nuevas[0].sucursal]})`;
            toast(`💰 Venta cerrada: ${txt}`);
            avisar("Venta cerrada", txt);
          } else if (nuevas.length > 1) {
            toast(`💰 Se cerraron ${nuevas.length} ventas`);
            avisar("Ventas cerradas", `Se cerraron ${nuevas.length} ventas`);
          }
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
      const totalSeg = d.seguimientos?.total ?? 0;
      setLeidosSeg((prev) => {
        const n = Math.min(prev, totalSeg);
        if (n !== prev) guardarLeidosSeg(n);
        return n;
      });
    } catch {
      /* sin red: se reintenta en el siguiente ciclo */
    }
  }, [toast, guardarLeidos, guardarLeidosSeg, avisar]);

  useEffect(() => {
    try {
      const n = Number(localStorage.getItem(leidosKey(username)) ?? 0);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia guardada en el navegador (solo cliente)
      if (Number.isFinite(n) && n > 0) setLeidos(n);
      const ns = Number(localStorage.getItem(leidosSegKey(username)) ?? 0);
      if (Number.isFinite(ns) && ns > 0) setLeidosSeg(ns);
    } catch {
      /* sin almacenamiento */
    }
    const p = leerPref(username);
    const permisoActual = permisoNotif();
    setPermiso(permisoActual);
    // Si el navegador ya no tiene el permiso, el aviso del sistema queda apagado.
    setPref(permisoActual === "granted" ? p : { ...p, notif: false });
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
  const seg = data.seguimientos;
  const segSinLeer = Math.max(0, (seg?.total ?? 0) - leidosSeg);
  const badge = sinLeer + segSinLeer + ventasNuevas;
  const rojo = (sinLeer > 0 && data.atrasados > 0) || (segSinLeer > 0 && (seg?.vencidos ?? 0) > 0) || ventasNuevas > 0;

  function markSalesSeen() {
    const latest = Math.max(Date.now(), ...(data.ventas ?? []).map((v) => new Date(v.cerradaAt).getTime()));
    setVistasHasta(latest);
    try {
      localStorage.setItem(seenKey(username), String(latest));
    } catch {
      /* ignorar */
    }
  }

  function actualizarPref(p: AvisosPref) {
    setPref(p);
    guardarPref(username, p);
  }

  async function cambiarNotif(activar: boolean) {
    if (!activar) return actualizarPref({ ...pref, notif: false });
    const p = await pedirPermiso(); // el navegador pregunta; debe salir de un clic
    setPermiso(p);
    actualizarPref({ ...pref, notif: p === "granted" });
    if (p === "granted") notificar("Avisos activados", "Así te avisaremos cuando llegue un lead nuevo.");
  }

  function cambiarSonido(activar: boolean) {
    if (activar) sonar(); // suena una vez para comprobarlo (y el navegador permite el audio)
    actualizarPref({ ...pref, sonido: activar });
  }

  function marcarTodoLeido() {
    setLeidos(data.total);
    guardarLeidos(data.total);
    setLeidosSeg(seg?.total ?? 0);
    guardarLeidosSeg(seg?.total ?? 0);
    if (coord) markSalesSeen();
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        aria-label={`Avisos: ${badge === 0 ? "todo leído" : `${badge} sin leer`}; ${data.total} leads sin atender${data.atrasados ? `, ${data.atrasados} con más de 24 h` : ""}${seg?.total ? `, ${seg.total} seguimientos para hoy o vencidos` : ""}${ventasNuevas ? `, ${ventasNuevas} ventas cerradas nuevas` : ""}`}
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

                {/* Seguimientos de hoy o vencidos, por sucursal */}
                <div className="border-b border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                  <p className="text-sm font-semibold text-slate-900">Seguimientos de hoy o vencidos</p>
                  <p className="text-xs text-slate-500">
                    {!seg || seg.total === 0 ? "Ninguno por ahora." : `${seg.total} en total${seg.vencidos ? ` · ${seg.vencidos} vencidos` : ""} · leads ya contactados`}
                  </p>
                </div>
                {(seg?.porSucursal ?? []).map((s) => (
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
                        {s.total} <span className="font-normal text-slate-500">seguimientos</span>
                      </span>
                      {s.vencidos > 0 && <span className="block text-[11px] font-semibold text-red-600">{s.vencidos} vencidos</span>}
                    </span>
                  </button>
                ))}

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

                {/* Seguimientos de hoy o vencidos */}
                <div className="border-b border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                  <p className="text-sm font-semibold text-slate-900">Seguimientos de hoy o vencidos</p>
                  <p className="text-xs text-slate-500">
                    {!seg || seg.total === 0 ? "Ninguno por ahora." : `${seg.total} en total${seg.vencidos ? ` · ${seg.vencidos} vencidos` : ""} · leads ya contactados`}
                  </p>
                </div>
                {(seg?.items ?? []).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      setOpen(false);
                      router.push(`/leads?editar=${l.id}`);
                    }}
                    className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{l.nombre}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {l.estado === "COTIZACION" || l.estado === "SEGUIMIENTO" ? "Cotización" : "Contactado"}
                        {l.asesor ? ` · ${l.asesor.split(" ")[0]}` : ""}
                      </span>
                    </span>
                    <span className={clsx("shrink-0 text-xs", l.vencido ? "font-semibold text-red-600" : "text-slate-500")}>
                      {l.vencido ? "Vencido " : "Hoy "}
                      {formatDateOnly(l.seguimiento, "d MMM")}
                    </span>
                  </button>
                ))}
                {seg && seg.total > (seg.items?.length ?? 0) && (
                  <button
                    onClick={() => {
                      setOpen(false);
                      router.push("/inicio");
                    }}
                    className="w-full px-4 py-2.5 text-center text-xs font-semibold text-brand hover:bg-slate-50"
                  >
                    Ver todos en Inicio
                  </button>
                )}
              </>
            )}

            {/* Avisos del navegador y sonido (cada persona elige) */}
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
              <label className="flex min-h-8 cursor-pointer items-center justify-between gap-3">
                <span>Avisarme en el navegador cuando llegue un lead</span>
                <input type="checkbox" checked={pref.notif} disabled={permiso === "unsupported"} onChange={(e) => void cambiarNotif(e.target.checked)} className="h-4 w-4 shrink-0" />
              </label>
              <label className="flex min-h-8 cursor-pointer items-center justify-between gap-3">
                <span>Sonido al llegar un lead</span>
                <input type="checkbox" checked={pref.sonido} onChange={(e) => cambiarSonido(e.target.checked)} className="h-4 w-4 shrink-0" />
              </label>
              {permiso === "denied" && <p className="mt-1 text-amber-700">Tu navegador bloqueó los avisos. Actívalos desde el candado de la barra de direcciones → Notificaciones.</p>}
              {permiso === "unsupported" && <p className="mt-1 text-slate-500">Este navegador no admite avisos del sistema.</p>}
              <p className="mt-1 text-slate-400">Funcionan mientras el CRM esté abierto en una pestaña.</p>
            </div>
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
