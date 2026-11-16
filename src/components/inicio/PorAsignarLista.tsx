"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Sucursal } from "@prisma/client";
import { AsignarDialog, type AsignarLead } from "@/components/leads/AsignarDialog";
import { useToast } from "@/components/ui/Toast";
import { asesoresFor } from "@/lib/catalogs";

type Item = { id: string; nombre: string; telefono: string; interes: string; sucursal: Sucursal; estado: string; createdAt: string; atrasado: boolean };

function hace(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

/** Leads sin asesor, con el botón "Asignar" en cada uno (para el gerente: asigna sin salir del Inicio). */
export function PorAsignarLista({ items, total, sucursal }: { items: Item[]; total: number; sucursal: Sucursal }) {
  const router = useRouter();
  const { toast, toastNode } = useToast();
  const [asignando, setAsignando] = useState<AsignarLead | null>(null);
  const [hechos, setHechos] = useState<Set<string>>(new Set());
  const sinRoster = asesoresFor(sucursal).length === 0;
  const visibles = items.filter((l) => !hechos.has(l.id));

  if (sinRoster) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-3 text-sm text-amber-900">
        Tu sucursal aún no tiene asesores registrados en el CRM, por eso no se pueden asignar desde aquí. Pide a Coordinación que los dé de alta.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-slate-100">
        {visibles.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
            <Link href={`/leads/${l.id}`} className="min-w-0 flex-1 hover:underline">
              <span className="block truncate text-sm font-semibold text-slate-900">{l.nombre}</span>
              <span className="block truncate text-xs text-slate-500">
                {l.interes || l.telefono} · hace {hace(l.createdAt)}
              </span>
            </Link>
            <button
              onClick={() => setAsignando({ id: l.id, nombre: l.nombre, interes: l.interes, sucursal: l.sucursal, estado: l.estado as AsignarLead["estado"], asesor: null })}
              className="min-h-9 shrink-0 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              Asignar
            </button>
          </li>
        ))}
      </ul>
      {total > items.length && (
        <Link href="/leads" className="mt-2 block text-center text-xs font-semibold text-brand hover:underline">
          Ver los {total} en Leads → “Ver y asignar”
        </Link>
      )}
      <AsignarDialog
        lead={asignando}
        onClose={() => setAsignando(null)}
        onDone={(r) => {
          toast(`✓ ${asignando?.nombre ?? "Lead"} → ${r.asesor}`);
          setHechos((s) => new Set(s).add(r.id));
          setAsignando(null);
          router.refresh(); // actualiza los conteos de la pantalla
        }}
      />
      {toastNode}
    </>
  );
}
