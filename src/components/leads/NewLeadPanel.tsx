"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Sucursal } from "@prisma/client";
import { NewLeadForm } from "./NewLeadForm";

/**
 * Panel lateral para cargar un lead sin salir de la pantalla de Leads (solo Coordinación).
 * En computadora la lista se queda a la izquierda y se actualiza sola; en celular ocupa toda la pantalla.
 * Si hay datos escritos y se intenta cerrar, pregunta antes de descartarlos.
 */
export function NewLeadPanel({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (nombre: string, sucursal: Sucursal, otro: boolean) => void;
}) {
  const dirty = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const tryClose = useCallback(() => {
    if (dirty.current && !window.confirm("Hay datos sin guardar. ¿Cerrar y descartarlos?")) return;
    dirty.current = false;
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && tryClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, tryClose]);

  if (!open) return null;
  return (
    <>
      {/* Fondo: solo en celular (en computadora la lista sigue a la vista y se puede usar). */}
      <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={tryClose} aria-hidden />
      <aside
        role="dialog"
        aria-label="Nuevo lead"
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-xl sm:w-[26rem] lg:w-[24rem]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Nuevo lead</h2>
            <p className="text-xs text-slate-500">Captura rápida: lo esencial para el gerente.</p>
          </div>
          <button onClick={tryClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-md text-xl text-slate-500 hover:bg-slate-100">
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          <NewLeadForm
            panel
            onDirty={(d) => {
              dirty.current = d;
            }}
            onCancel={tryClose}
            onSaved={(nombre, sucursal, otro) => {
              dirty.current = false;
              onSaved(nombre, sucursal, otro);
            }}
          />
        </div>
      </aside>
    </>
  );
}
