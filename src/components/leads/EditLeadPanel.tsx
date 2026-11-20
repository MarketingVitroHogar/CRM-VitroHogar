"use client";

import { useEffect, useState } from "react";
import type { Role } from "@prisma/client";
import { SidePanel } from "@/components/ui/SidePanel";
import { LeadForm } from "./LeadForm";
import type { LeadDTO } from "@/lib/types";

/**
 * Panel lateral para editar un lead sin salir de la pantalla de Leads (Coordinación y gerentes).
 * Trae el lead actualizado del servidor al abrirse; el servidor decide qué puede ver y editar cada perfil.
 */
export function EditLeadPanel({
  id,
  role,
  onClose,
  onSaved,
}: {
  id: string | null;
  role: Role;
  onClose: () => void;
  onSaved: (nombre: string) => void;
}) {
  const [lead, setLead] = useState<LeadDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- al abrir otro lead se empieza de cero
    setLead(null);
    setError(null);
    if (!id) return;
    let ignore = false;
    fetch(`/api/leads/${id}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (ignore) return;
        if (!res.ok) setError(typeof data.error === "string" ? data.error : "No se pudo abrir el lead.");
        else setLead(data.lead as LeadDTO);
      })
      .catch(() => {
        if (!ignore) setError("Error de red al abrir el lead.");
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  return (
    <SidePanel open={!!id} onClose={onClose} title="Editar lead" subtitle={lead?.nombre}>
      {({ setDirty, tryClose }) =>
        error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : !lead ? (
          <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>
        ) : (
          <LeadForm
            key={lead.id}
            mode="edit"
            role={role}
            lead={lead}
            panel
            onDirty={setDirty}
            onCancel={tryClose}
            onSaved={(nombre) => {
              setDirty(false);
              onSaved(nombre);
            }}
          />
        )
      }
    </SidePanel>
  );
}
