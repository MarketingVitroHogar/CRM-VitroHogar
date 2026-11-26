/** El usuario de un asesor es su número de nómina: solo dígitos (de 3 a 10). Devuelve null si no es válido. */
export function parseNomina(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return /^[0-9]{3,10}$/.test(s) ? s : null;
}

export const NOMINA_AYUDA = "Escribe solo el número de nómina (de 3 a 10 dígitos).";
