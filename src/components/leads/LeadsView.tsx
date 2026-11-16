"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { SUCURSALES } from "@/lib/catalogs";
import type { Role } from "@prisma/client";
import { LeadFilters, type LeadFilterState } from "./LeadFilters";
import { LeadSearchBox } from "./LeadSearchBox";
import { LeadCard } from "./LeadCard";
import { LeadsKanban } from "./LeadsKanban";
import { LeadsTable } from "./LeadsTable";
import { VISTA_STORAGE_KEY, type LeadsVista } from "@/lib/kanban";
import { PERIODO_POR_DEFECTO, periodoDeUrl, rangoDe, textoRango } from "@/lib/periodos";
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

  // Si ya estás en Leads y tocas una sucursal en la campana, los filtros se actualizan.
  const urlKey = searchParams.toString();
  useEffect(() => {
    if (!urlKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza los filtros con la dirección
    setFilters((f) => ({ ...f, ...filtersFromUrl(new URLSearchParams(urlKey), role), q: "" }));
  }, [urlKey, role]);
  const [vista, setVista] = useState<LeadsVista>("kanban");
  const [leads, setLeads] = useState<LeadDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

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
      const rango = rangoDe(filters.periodo);
      if (rango) {
        params.set("desde", rango.from);
        params.set("hasta", rango.to);
      }
      if (filters.q) {
        params.set("q", filters.q);
        if (filters.qEnPeriodo) params.set("qEnPeriodo", "1");
      }
      // En Kanban las columnas son los estados: el filtro de estado no aplica.
      if (filters.estado && vista !== "kanban") params.set("estado", filters.estado);
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
    [filters, role, vista]
  );

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
          <Link href="/leads/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            + Nuevo lead
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <LeadFilters value={filters} onChange={setFilters} showSucursal={role === "coord"} showEstado={vista !== "kanban"} />
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
        </p>
      )}

      {!loading && leads.length > 0 && vista === "kanban" && (
        <LeadsKanban leads={leads} role={role} setLeads={setLeads} reload={() => fetchLeads(true)} />
      )}

      {!loading && leads.length > 0 && vista === "lista" && <LeadsTable leads={pageLeads} role={role} onDelete={handleDelete} />}

      {!loading && leads.length > 0 && vista === "tarjetas" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} role={role} showSucursal={role === "coord"} onDelete={handleDelete} />
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
    </div>
  );
}
