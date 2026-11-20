"use client";

import { useCallback, useEffect, useState } from "react";

export type SidePanelApi = {
  /** El formulario avisa si hay datos sin guardar (para preguntar antes de cerrar). */
  setDirty: (dirty: boolean) => void;
  /** Cierra el panel; si hay datos sin guardar, pregunta antes de descartarlos. */
  tryClose: () => void;
};

/**
 * Panel lateral (Nuevo lead, Editar lead…): se abre ENCIMA de la pantalla, con fondo atenuado.
 * Se cierra con la ×, Escape o tocando el fondo; si hay datos sin guardar, pregunta antes.
 * En celular ocupa toda la pantalla.
 */
export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: (api: SidePanelApi) => React.ReactNode;
}) {
  const [dirty, setDirty] = useState(false);

  const tryClose = useCallback(() => {
    if (dirty && !window.confirm("Hay datos sin guardar. ¿Cerrar y descartarlos?")) return;
    setDirty(false);
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && tryClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, tryClose]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={tryClose} aria-hidden />
      <aside role="dialog" aria-label={title} className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-xl sm:w-[26rem] lg:w-[24rem]">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={tryClose} aria-label="Cerrar" className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-xl text-slate-500 hover:bg-slate-100">
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 pt-4">{children({ setDirty, tryClose })}</div>
      </aside>
    </>
  );
}
