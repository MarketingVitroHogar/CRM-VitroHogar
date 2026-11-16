/**
 * Normaliza el usuario que se escribe en el login: sin espacios al inicio/final,
 * en minúsculas y sin acentos. Así "Gerente.Colón", "gerente.colon " y
 * "gerente.colon" son la misma cuenta (los usuarios guardados son minúsculas sin acento).
 */
export function normalizeUsername(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}
