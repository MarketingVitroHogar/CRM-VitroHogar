"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { LeadFilters, type LeadFilterState } from "./LeadFilters";
import { LeadCard } from "./LeadCard";
import type { LeadDTO } from "@/lib/types";

export function LeadsView({ role }: { role: Role }) {
  const [filters, setFilters] = useState<LeadFilterState>({ mes: "", sucursal: "", estado: "" });
  const [leads, setLeads] = useState<LeadDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function fetchLeads() {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filters.mes) params.set("mes", filters.mes);
      if (filters.estado) params.set("estado", filters.estado);
      if (role === "coord" && filters.sucursal) params.set("sucursal", filters.sucursal);

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
        <LeadFilters value={filters} onChange={setFilters} showSucursal={role === "coord"} />
        {role === "coord" && (
          <Link
            href="/leads/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            + Nuevo lead
          </Link>
        )}
      </div>

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
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            role={role}
            showSucursal={role === "coord"}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
