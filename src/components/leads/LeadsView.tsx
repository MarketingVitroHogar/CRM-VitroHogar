"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { LeadFilters, type LeadFilterState } from "./LeadFilters";
import { LeadSearchBox } from "./LeadSearchBox";
import { LeadCard } from "./LeadCard";
import type { LeadDTO } from "@/lib/types";

const LEADS_PER_PAGE = 15; // 3 columnas x 5 filas en escritorio

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function LeadsView({ role }: { role: Role }) {
  const [filters, setFilters] = useState<LeadFilterState>({
    mes: currentMonthValue(),
    sucursal: "",
    estado: "",
    orden: "desc",
    q: "",
  });
  const [leads, setLeads] = useState<LeadDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let ignore = false;

    async function fetchLeads() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filters.q) {
        params.set("q", filters.q);
      } else if (filters.mes) {
        params.set("mes", filters.mes);
      }
      if (filters.estado) params.set("estado", filters.estado);
      if (role === "coord" && filters.sucursal) params.set("sucursal", filters.sucursal);
      params.set("orden", filters.orden);

      try {
        const res = await fetch(`/api/leads?${params.toString()}`);
        if (!res.ok) throw new Error("No se pudieron cargar los leads");
        const data = await res.json();
        if (!ignore) setLeads(data.leads);
      } catch {
        if (!ignore) setError("Ocurrió un error al cargar los leads.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchLeads();
    return () => {
      ignore = true;
    };
  }, [filters, role]);

  useEffect(() => {
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
        <LeadSearchBox value={filters.q} onSearch={(q) => setFilters((prev) => ({ ...prev, q }))} />
        {role === "coord" && (
          <Link
            href="/leads/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            + Nuevo lead
          </Link>
        )}
      </div>

      <LeadFilters value={filters} onChange={setFilters} showSucursal={role === "coord"} />
      {filters.q && (
        <p className="-mt-2 text-xs text-slate-400">
          Buscando &quot;{filters.q}&quot; en todos los meses — el filtro de mes no aplica mientras hay una búsqueda activa.
        </p>
      )}

      <p className="text-sm text-slate-500">
        {loading ? "Cargando…" : `${leads.length} lead${leads.length === 1 ? "" : "s"} encontrado${leads.length === 1 ? "" : "s"}`}
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && leads.length === 0 && !error && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          No hay leads que coincidan con estos filtros.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pageLeads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            role={role}
            showSucursal={role === "coord"}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {!loading && leads.length > LEADS_PER_PAGE && (
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
