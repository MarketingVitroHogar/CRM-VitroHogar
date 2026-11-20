"use client";

import { useEffect, useState } from "react";
import { aplicarPreferencia, esNoche, leerPreferencia, type TemaPref } from "@/lib/tema";

/** Estado del tema (claro / noche) y su preferencia, sincronizado con el dispositivo cuando está en automático. */
export function useTema() {
  const [pref, setPref] = useState<TemaPref>("auto");
  const [noche, setNoche] = useState(false);

  useEffect(() => {
    const p = leerPreferencia();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia guardada en el navegador (solo cliente)
    setPref(p);
    setNoche(esNoche(p));
    // En automático, si el dispositivo cambia de modo (por la noche, por ejemplo), el CRM lo sigue.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (leerPreferencia() === "auto") {
        document.documentElement.classList.toggle("dark", mq.matches);
        setNoche(mq.matches);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function elegir(p: TemaPref) {
    aplicarPreferencia(p);
    setPref(p);
    setNoche(esNoche(p));
  }
  return { pref, noche, elegir };
}

/** Botón de la luna / el sol: cambia entre modo claro y modo noche. */
export function ThemeToggle({ noche, onToggle }: { noche: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={noche ? "Cambiar a modo claro" : "Cambiar a modo noche"}
      title={noche ? "Modo claro" : "Modo noche"}
      className="grid h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
    >
      {noche ? (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
