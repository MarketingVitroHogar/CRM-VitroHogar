"use client";

import type { Sucursal } from "@prisma/client";
import { SidePanel } from "@/components/ui/SidePanel";
import { NewLeadForm } from "./NewLeadForm";

/** Panel lateral para cargar un lead sin salir de la pantalla de Leads (solo Coordinación). */
export function NewLeadPanel({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (nombre: string, sucursal: Sucursal, otro: boolean) => void;
}) {
  return (
    <SidePanel open={open} onClose={onClose} title="Nuevo lead" subtitle="Captura rápida: lo esencial para el gerente.">
      {({ setDirty, tryClose }) => (
        <NewLeadForm
          panel
          onDirty={setDirty}
          onCancel={tryClose}
          onSaved={(nombre, sucursal, otro) => {
            setDirty(false);
            onSaved(nombre, sucursal, otro);
          }}
        />
      )}
    </SidePanel>
  );
}
