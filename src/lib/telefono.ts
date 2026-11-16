/** Solo los dígitos de un teléfono. */
export const soloDigitos = (v: string) => v.replace(/[^0-9]/g, "");

/**
 * Da formato al teléfono mientras se escribe: "4921234567" → "492 123 4567".
 * Si trae lada de país (más de 10 dígitos), lo de adelante queda separado: "52 492 123 4567".
 */
export function formatTelefono(v: string): string {
  const d = soloDigitos(v).slice(0, 13);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  const extra = d.length - 10;
  const lada = d.slice(0, extra);
  const r = d.slice(extra);
  return `${lada} ${r.slice(0, 3)} ${r.slice(3, 6)} ${r.slice(6)}`;
}

export const telefonoValido = (v: string) => soloDigitos(v).length >= 10;
