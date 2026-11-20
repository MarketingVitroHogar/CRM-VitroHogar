"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Vuelve a cargar los datos de la pantalla (sin recargar la página) cada minuto y al volver a la pestaña.
 * No lo hace mientras haya un panel o diálogo abierto, para no interrumpir lo que la persona esté haciendo.
 */
export function AutoRefresh({ cadaMs = 60_000 }: { cadaMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refrescar = () => {
      if (document.hidden) return;
      if (document.querySelector("[role=dialog]")) return;
      router.refresh();
    };
    const t = setInterval(refrescar, cadaMs);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, [router, cadaMs]);
  return null;
}
