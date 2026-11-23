"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { SUCURSALES, SUCURSAL_LABELS, ESTADO_LABELS } from "@/lib/catalogs";
import type { Role } from "@prisma/client";
import { LeadFilters, type LeadFilterState } from "./LeadFilters";
import { LeadSearchBox } from "./LeadSearchBox";
import { LeadCard } from "./LeadCard";
import { LeadsKanban } from "./LeadsKanban";
import { LeadsTable } from "./LeadsTable";
import { NewLeadPanel } from "./NewLeadPanel";
import { EditLeadPanel } from "./EditLeadPanel";
import { AsignarDialog, LEADS_CHANGED_EVENT, type AsignarResult } from "./AsignarDialog";
import { useToast } from "@/components/ui/Toast";
import { VISTA_STORAGE_KEY, type LeadsVista } from "@/lib/kanban";
import { PERIODO_POR_DEFECTO, PERIODOS_EXTRA, PERIODOS_RAPIDOS, periodoDeUrl, rangoDe, textoRango } from "@/lib/periodos";
import { FiltrosActivos, type FiltroChip } from "./FiltrosActivos";
import type { LeadDTO } from "@/lib/types";

const LEADS_PER_PAGE = 15; // lista y tarjetas

const VISTAS: { key: LeadsVista; label: string }[] = [
  { key: "kanban", label: "Kanban" },
  { key: "lista", label: "Lista" },
  { key: "tarjetas", label: "Tarjetas" },
];

/** Filtros que vienen en la dirección (p. ej. desde la campana de Coordinación: /leads?sucursal=COLON&mes=todos). */
function filtersFromUrl(sp: URLSearchParams, role: Role): Pick<LeadFilterState, "periodo" | "sucursal"> {
  const suc = sp.get("sucursal");
  // mes=todos (campana) o periodo=hoy|ayer|semana|mes|todo…; sin nada → "Este mes".
  const periodo = periodoDeUrl(sp.get("periodo")) ?? (sp.get("mes") === "todos" ? periodoDeUrl("todo") : null) ?? PERIODO_POR_DEFECTO;
  return {
    periodo,
    // Solo Coordinación elige sucursal; el gerente siempre queda limitado a la suya en el servidor.
    sucursal: role === "coord" && suc && (SUCURSALES as string[]).includes(suc) ? suc : "",
  };
}

export function LeadsView({ role }: { role: Role }) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<LeadFilterState>(() => ({
    ...filtersFromUrl(searchParams, role),
    estado: "",
    orden: "desc",
    q: "",
    qEnPeriodo: false,
  }));

  // "Por asignar": leads abiertos sin asesor del mes en curso (se ignora el periodo elegido).
  const [soloPorAsignar, setSoloPorAsignar] = useState(() => role === "gerente" && searchParams.get("sinAsesor") === "1");
  // "Abiertos de meses anteriores": leads sin cerrar ingresados antes de este mes (se abre desde Inicio).
  const [soloAnteriores, setSoloAnteriores] = useState(() => searchParams.get("abiertos") === "anteriores");
  // Panel lateral "Nuevo lead" (solo Coordinación). También se abre con /leads?nuevo=1 (botón de Inicio).
  const [nuevoAbierto, setNuevoAbierto] = useState(() => role === "coord" && searchParams.get("nuevo") === "1");
  // Panel lateral "Editar lead" (id del lead abierto). También se abre con /leads?editar=ID (Inicio, campana).
  const [editandoId, setEditandoId] = useState<string | null>(() => searchParams.get("editar"));
  // Si ya estás en Leads y tocas una sucursal en la campana, los filtros se actualizan.
  const urlKey = searchParams.toString();
  useEffect(() => {
    if (!urlKey) return;
    const sp = new URLSearchParams(urlKey);
    // "nuevo" y "editar" solo abren un panel: no deben reiniciar los filtros que ya elegiste.
    if ([...sp.keys()].some((k) => k !== "nuevo" && k !== "editar")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza los filtros con la dirección
      setFilters((f) => ({ ...f, ...filtersFromUrl(sp, role), q: "" }));
      setSoloPorAsignar(role === "gerente" && sp.get("sinAsesor") === "1");
      setSoloAnteriores(sp.get("abiertos") === "anteriores");
    }
    let abrio = false;
    if (role === "coord" && sp.get("nuevo") === "1") {
      setNuevoAbierto(true);
      abrio = true;
    }
    const editar = sp.get("editar");
    if (editar) {
      setEditandoId(editar);
      abrio = true;
    }
    if (abrio) {
      // Quita "nuevo" / "editar" de la dirección para que al recargar la página no se vuelva a abrir el panel.
      sp.delete("nuevo");
      sp.delete("editar");
      window.history.replaceState(null, "", sp.toString() ? `/leads?${sp.toString()}` : "/leads");
    }
  }, [urlKey, role]);
  const [vista, setVista] = useState<LeadsVista>("kanban");
  const [leads, setLeads] = useState<LeadDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { toast, toastNode } = useToast();
  const [porAsignar, setPorAsignar] = useState(0);
  const [asignando, setAsignando] = useState<LeadDTO | null>(null);

  // Cada persona recupera la vista que eligió la última vez (por defecto, Kanban).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VISTA_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia guardada en el navegador (solo cliente)
      if (saved === "kanban" || saved === "lista" || saved === "tarjetas") setVista(saved);
    } catch {
      /* sin almacenamiento: se queda en Kanban */
    }
  }, []);

  function changeVista(v: LeadsVista) {
    setVista(v);
    // Al pasar al Kanban, los estados sueltos ya no aplican (sus columnas los muestran); "Sin seguimiento" sí se conserva.
    if (v === "kanban") setFilters((f) => (f.estado && f.estado !== "SIN_SEGUIMIENTO" ? { ...f, estado: "" } : f));
    setPage(1);
    try {
      localStorage.setItem(VISTA_STORAGE_KEY, v);
    } catch {
      /* ignorar */
    }
  }

  const fetchLeads = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setLoading(true);
        setError(null);
      }
      const params = new URLSearchParams();
      // El rango se calcula al momento de pedir (así "Hoy" siempre es el día actual).
      // "Por asignar" siempre es del mes en curso (igual que Inicio y la campana).
      const rango = soloAnteriores ? null : rangoDe(soloPorAsignar ? PERIODO_POR_DEFECTO : filters.periodo);
      if (rango) {
        params.set("desde", rango.from);
        params.set("hasta", rango.to);
      }
      if (soloPorAsignar) params.set("sinAsesor", "1");
      if (soloAnteriores) params.set("abiertosAnteriores", "1");
      if (filters.q) {
        params.set("q", filters.q);
        if (filters.qEnPeriodo) params.set("qEnPeriodo", "1");
      }
      // En Kanban las columnas son los estados: el filtro de estado no aplica.
      // En el Kanban las columnas son los estados: solo aplica el filtro "Sin seguimiento".
      if (filters.estado && !soloPorAsignar && !soloAnteriores && (vista !== "kanban" || filters.estado === "SIN_SEGUIMIENTO")) params.set("estado", filters.estado);
      if (role === "coord" && filters.sucursal) params.set("sucursal", filters.sucursal);
      params.set("orden", filters.orden);

      try {
        const res = await fetch(`/api/leads?${params.toString()}`);
        if (!res.ok) throw new Error("No se pudieron cargar los leads");
        const data = await res.json();
        setLeads(data.leads);
      } catch {
        if (!quiet) setError("Ocurrió un error al cargar los leads.");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [filters, role, vista, soloPorAsignar, soloAnteriores]
  );

  // Cuántos leads siguen sin asesor (para el aviso de arriba). Solo el gerente asigna: Coordinación no ve este aviso.
  const fetchPorAsignar = useCallback(async () => {
    if (role !== "gerente") return;
    try {
      const rango = rangoDe(PERIODO_POR_DEFECTO);
      const res = await fetch(`/api/leads?sinAsesor=1${rango ? `&desde=${rango.from}&hasta=${rango.to}` : ""}`);
      if (!res.ok) return;
      const data = await res.json();
      setPorAsignar(Array.isArray(data.leads) ? data.leads.length : 0);
    } catch {
      /* se queda el número anterior */
    }
  }, [role]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del conteo
    fetchPorAsignar();
  }, [fetchPorAsignar]);

  // La lista se actualiza sola cada minuto y al volver a la pestaña (no mientras haya un panel o diálogo abierto).
  useEffect(() => {
    const refrescar = () => {
      if (document.hidden) return;
      if (document.querySelector("[role=dialog]")) return;
      void fetchLeads(true);
      void fetchPorAsignar();
    };
    const t = setInterval(refrescar, 60_000);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, [fetchLeads, fetchPorAsignar]);

  // Si se asigna un lead desde otra pantalla (la campana), esta lista se actualiza sola.
  useEffect(() => {
    const onChanged = () => {
      void fetchLeads(true);
      void fetchPorAsignar();
    };
    window.addEventListener(LEADS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(LEADS_CHANGED_EVENT, onChanged);
  }, [fetchLeads, fetchPorAsignar]);

  function handleAssigned(r: AsignarResult) {
    const who = asignando?.nombre ?? "El lead";
    setAsignando(null);
    // Se ve al instante; si estamos en "Por asignar", el lead sale de la lista.
    setLeads((prev) =>
      soloPorAsignar ? prev.filter((l) => l.id !== r.id) : prev.map((l) => (l.id === r.id ? { ...l, asesor: r.asesor, ...(r.estado ? { estado: r.estado } : {}) } : l))
    );
    toast(`✓ ${who} → ${r.asesor}`);
    void fetchLeads(true);
    void fetchPorAsignar();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al cambiar filtros o vista
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- al cambiar filtros se vuelve a la página 1
    setPage(1);
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(leads.length / LEADS_PER_PAGE));
  const pageLeads = leads.slice((page - 1) * LEADS_PER_PAGE, page * LEADS_PER_PAGE);

  // Filtros puestos, como etiquetas. "Este mes", "Todas las sucursales" y "Más reciente primero" son lo normal: no cuentan.
  // En "Por asignar" y "Abiertos de meses anteriores" el periodo y el estado no aplican, así que no se muestran.
  const modoEspecial = soloPorAsignar || soloAnteriores;
  const chips: FiltroChip[] = [];
  if (!modoEspecial && filters.periodo.key !== PERIODO_POR_DEFECTO.key) {
    const p = filters.periodo;
    const nombre = p.key === "personalizado" ? textoRango(rangoDe(p)) : ([...PERIODOS_RAPIDOS, ...PERIODOS_EXTRA].find((x) => x.key === p.key)?.label ?? p.key);
    chips.push({ key: "periodo", label: `Fecha: ${nombre}`, onQuitar: () => setFilters((f) => ({ ...f, periodo: PERIODO_POR_DEFECTO })) });
  }
  if (role === "coord" && filters.sucursal) {
    chips.push({ key: "sucursal", label: `Sucursal: ${SUCURSAL_LABELS[filters.sucursal as keyof typeof SUCURSAL_LABELS] ?? filters.sucursal}`, onQuitar: () => setFilters((f) => ({ ...f, sucursal: "" })) });
  }
  if (!modoEspecial && filters.estado && (vista !== "kanban" || filters.estado === "SIN_SEGUIMIENTO")) {
    const nombre = filters.estado === "SIN_SEGUIMIENTO" ? "Sin seguimiento" : (ESTADO_LABELS[filters.estado as keyof typeof ESTADO_LABELS] ?? filters.estado);
    chips.push({ key: "estado", label: `Estado: ${nombre}`, onQuitar: () => setFilters((f) => ({ ...f, estado: "" })) });
  }
  if (filters.q) chips.push({ key: "q", label: `Búsqueda: “${filters.q}”`, onQuitar: () => setFilters((f) => ({ ...f, q: "" })) });
  if (!modoEspecial && filters.orden === "asc") chips.push({ key: "orden", label: "Más antiguos primero", onQuitar: () => setFilters((f) => ({ ...f, orden: "desc" })) });
  function limpiarFiltros() {
    setFilters({ periodo: PERIODO_POR_DEFECTO, sucursal: "", estado: "", orden: "desc", q: "", qEnPeriodo: false });
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este lead? Esta acción no se puede deshacer.")) return;
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } else {
      alert("No se pudo eliminar el lead.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <LeadSearchBox
          value={filters.q}
          onSearch={(q) => setFilters((prev) => ({ ...prev, q }))}
          enPeriodo={filters.qEnPeriodo}
          onEnPeriodoChange={(v) => setFilters((prev) => ({ ...prev, qEnPeriodo: v }))}
        />
        {role === "coord" && (
          <button
            onClick={() => setNuevoAbierto(true)}
            aria-expanded={nuevoAbierto}
            className="min-h-10 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            + Nuevo lead
          </button>
        )}
      </div>

      {soloAnteriores && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5">
          <p className="text-sm font-medium text-slate-800">
            Mostrando {loading ? "…" : leads.length} lead{leads.length === 1 ? "" : "s"} abierto{leads.length === 1 ? "" : "s"} de meses anteriores (sin cerrar).
          </p>
          <button
            onClick={() => {
              setSoloAnteriores(false);
              setPage(1);
              window.history.replaceState(null, "", "/leads");
            }}
            className="min-h-9 rounded-md bg-brand px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Ver el mes actual
          </button>
        </div>
      )}

      {/* Aviso "Por asignar": lo primero que debe ver el gerente */}
      {(porAsignar > 0 || soloPorAsignar) && (
        <div className={clsx("flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2.5", soloPorAsignar ? "border-brand bg-red-50" : "border-amber-300 bg-amber-50")}>
          <p className="text-sm font-medium text-slate-800">
            {soloPorAsignar
              ? `Mostrando los ${leads.length} lead${leads.length === 1 ? "" : "s"} sin asesor (de este mes).`
              : `${porAsignar} lead${porAsignar === 1 ? "" : "s"} por asignar a un asesor`}
          </p>
          <button
            onClick={() => {
              setSoloPorAsignar((v) => !v);
              setPage(1);
            }}
            className="min-h-9 rounded-md bg-brand px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            {soloPorAsignar ? "Ver todos los leads" : "Ver y asignar"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* En "Por asignar" el periodo y el estado no aplican, así que se ocultan para no confundir. */}
        {soloPorAsignar || soloAnteriores ? <span /> : <LeadFilters value={filters} onChange={setFilters} showSucursal={role === "coord"} estadoReducido={vista === "kanban"} />}
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5" role="group" aria-label="Tipo de vista">
          {VISTAS.map((v) => (
            <button
              key={v.key}
              onClick={() => changeVista(v.key)}
              aria-pressed={vista === v.key}
              className={clsx("rounded-md px-3.5 py-1.5 text-sm font-medium", vista === v.key ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50")}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <FiltrosActivos chips={chips} onLimpiar={limpiarFiltros} />

      {filters.q && (
        <p className="-mt-2 text-xs text-slate-500">
          Buscando &quot;{filters.q}&quot; {filters.qEnPeriodo ? `solo en el periodo elegido (${textoRango(rangoDe(filters.periodo))})` : "en todos los periodos"}.
        </p>
      )}

      <p className="text-sm text-slate-500" aria-live="polite">
        {loading ? "Cargando…" : `${leads.length} lead${leads.length === 1 ? "" : "s"} encontrado${leads.length === 1 ? "" : "s"}`}
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && leads.length === 0 && !error && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          No hay leads que coincidan con estos filtros.
          {chips.length > 0 && (
            <button onClick={limpiarFiltros} className="mx-auto mt-3 block min-h-9 rounded-md bg-brand px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">
              Limpiar filtros
            </button>
          )}
        </p>
      )}

      {!loading && leads.length > 0 && vista === "kanban" && (
        <LeadsKanban leads={leads} role={role} setLeads={setLeads} reload={() => Promise.all([fetchLeads(true), fetchPorAsignar()]).then(() => undefined)} onAssign={setAsignando} onEdit={setEditandoId} />
      )}

      {!loading && leads.length > 0 && vista === "lista" && <LeadsTable leads={pageLeads} role={role} onDelete={handleDelete} onAssign={setAsignando} onEdit={setEditandoId} />}

      {!loading && leads.length > 0 && vista === "tarjetas" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} role={role} showSucursal={role === "coord"} onDelete={handleDelete} onAssign={setAsignando} onEdit={setEditandoId} />
          ))}
        </div>
      )}

      {!loading && vista !== "kanban" && leads.length > LEADS_PER_PAGE && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-slate-500">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}

      {role === "coord" && (
        <NewLeadPanel
          open={nuevoAbierto}
          onClose={() => setNuevoAbierto(false)}
          onSaved={(nombre, sucursal, otro) => {
            toast(`✓ Lead guardado: ${nombre} · ${SUCURSAL_LABELS[sucursal]}`);
            if (!otro) setNuevoAbierto(false);
          }}
        />
      )}
      <EditLeadPanel
        id={editandoId}
        role={role}
        onClose={() => setEditandoId(null)}
        onSaved={(nombre) => {
          toast(`✓ Cambios guardados: ${nombre}`);
          setEditandoId(null);
        }}
      />
      <AsignarDialog lead={asignando} onClose={() => setAsignando(null)} onDone={handleAssigned} />
      {toastNode}
    </div>
  );
}
