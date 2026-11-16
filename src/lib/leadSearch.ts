import { normalizeText } from "@/lib/textMatch";

/** Campos del lead donde se busca. */
export type SearchableLead = {
  id: string;
  nombre: string;
  telefono: string;
  interes: string;
  asesor: string | null;
  folioCotizacion: string | null;
  folioFactura: string | null;
};

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/**
 * Búsqueda de leads:
 *  - ignora mayúsculas y acentos ("jose" encuentra "José");
 *  - varias palabras = todas deben aparecer ("maria lopez" encuentra "María López Ruiz", en cualquier orden);
 *  - un teléfono se busca por sus dígitos, con o sin espacios/guiones ("492-123" encuentra "492 123 4567");
 *  - busca en nombre, teléfono, interés, asesor y folios de cotización/factura.
 * Devuelve los ids que coinciden.
 */
export function searchLeadIds(leads: SearchableLead[], rawQuery: string): string[] {
  const q = normalizeText(rawQuery);
  if (!q) return leads.map((l) => l.id);

  const digitsQuery = /^[\d\s()+.-]+$/.test(rawQuery.trim()) ? onlyDigits(rawQuery) : "";
  const terms = q.split(" ").filter(Boolean);

  return leads
    .filter((l) => {
      const haystack = normalizeText([l.nombre, l.telefono, l.interes, l.asesor ?? "", l.folioCotizacion ?? "", l.folioFactura ?? ""].join(" "));
      if (digitsQuery.length >= 3) {
        // Parece un teléfono (o un folio numérico): por dígitos del teléfono, o texto tal cual en folios.
        return onlyDigits(l.telefono).includes(digitsQuery) || haystack.includes(q);
      }
      return terms.every((t) => haystack.includes(t));
    })
    .map((l) => l.id);
}
