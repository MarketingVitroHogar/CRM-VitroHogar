/**
 * Tema del CRM: claro o noche. La preferencia se guarda en el navegador de cada persona:
 *  - "claro" / "noche": elección manual (el botón de la luna / el sol).
 *  - sin valor ("automático"): sigue el modo del dispositivo.
 */
export const TEMA_KEY = "crm:tema";
export type TemaPref = "claro" | "noche" | "auto";

/** Se ejecuta en <head>, ANTES de pintar la página, para que no parpadee en blanco al abrir de noche. */
export const TEMA_SCRIPT = `(function(){try{var p=localStorage.getItem("${TEMA_KEY}");var d=p==="noche"||(p!=="claro"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})()`;

export function leerPreferencia(): TemaPref {
  try {
    const p = localStorage.getItem(TEMA_KEY);
    return p === "claro" || p === "noche" ? p : "auto";
  } catch {
    return "auto";
  }
}

export function esNoche(pref: TemaPref): boolean {
  if (pref === "noche") return true;
  if (pref === "claro") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Guarda la preferencia y aplica el tema al momento. */
export function aplicarPreferencia(pref: TemaPref) {
  try {
    if (pref === "auto") localStorage.removeItem(TEMA_KEY);
    else localStorage.setItem(TEMA_KEY, pref);
  } catch {
    /* sin almacenamiento: el cambio vale solo mientras la página está abierta */
  }
  document.documentElement.classList.toggle("dark", esNoche(pref));
}
