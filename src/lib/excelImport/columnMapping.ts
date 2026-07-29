import type { Fuente, Sucursal } from "@prisma/client";
import { closestMatch, normalizeText } from "@/lib/textMatch";

export type CanonicalField =
  | "fecha"
  | "nombre"
  | "telefono"
  | "interes"
  | "sucursal"
  | "fuenteCombinada"
  | "wa"
  | "fb"
  | "ig"
  | "tt";

const HEADER_ALIASES: Record<CanonicalField, string[]> = {
  fecha: ["fecha", "fecha ingreso", "fecha de ingreso", "fecha de registro"],
  nombre: ["nombre", "cliente", "nombre cliente", "nombre del cliente"],
  telefono: ["telefono", "número", "numero", "celular", "whatsapp cliente", "tel"],
  interes: ["que busca", "interes", "interés", "producto", "producto de interes"],
  sucursal: ["sucursal", "tienda", "sucursal/tienda", "sucursal tienda"],
  fuenteCombinada: ["fuente", "canal", "plataforma", "medio"],
  wa: ["wa", "whatsapp"],
  fb: ["fb", "facebook"],
  ig: ["ig", "instagram"],
  tt: ["tt", "tiktok", "tik tok"],
};

const HEADER_MATCH_DISTANCE = 2;

// Real-world sheets often combine a recognizable hint word with unrelated
// text in one header cell (e.g. "WHATS / TELÉFONO", "PRODUCTO O CATEGORÍA
// INTERÉS") — too far edit-distance-wise from any alias to match above, but
// they do contain a full alias as a substring. This fallback only fires when
// the exact/Levenshtein pass above found nothing, and is skipped for the
// wa/fb/ig/tt flag fields since their 2-letter aliases would false-positive
// against almost any longer header (e.g. "ig" inside "seguimiento").
const SUBSTRING_MIN_ALIAS_LENGTH = 6;
const FLAG_FIELDS: CanonicalField[] = ["wa", "fb", "ig", "tt"];

export type ColumnMapping = Partial<Record<CanonicalField, number>>;

/** Maps each header cell (by column index) to a canonical field, if recognized. */
export function mapColumns(headerRow: unknown[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const candidates = (Object.keys(HEADER_ALIASES) as CanonicalField[]).map((key) => ({
    key,
    aliases: HEADER_ALIASES[key],
  }));

  headerRow.forEach((cell, index) => {
    const text = String(cell ?? "").trim();
    if (!text) return;

    let match = closestMatch(text, candidates, HEADER_MATCH_DISTANCE);

    if (!match) {
      const normalizedText = normalizeText(text);
      let bestAliasLength = 0;
      for (const candidate of candidates) {
        if (FLAG_FIELDS.includes(candidate.key)) continue;
        for (const alias of candidate.aliases) {
          if (alias.length < SUBSTRING_MIN_ALIAS_LENGTH) continue;
          if (normalizedText.includes(alias) && alias.length > bestAliasLength) {
            match = candidate.key;
            bestAliasLength = alias.length;
          }
        }
      }
    }

    if (match && mapping[match as CanonicalField] === undefined) {
      mapping[match as CanonicalField] = index;
    }
  });

  return mapping;
}

const SUCURSAL_ALIASES: Record<Sucursal, string[]> = {
  BLVD_ZACATECAS: ["blvd zacatecas", "boulevard zacatecas", "blvd. zacatecas", "zacatecas"],
  UNIVERSIDAD: ["universidad"],
  HACIENDAS: ["haciendas"],
  LOPEZ_MATEOS: ["lopez mateos", "lópez mateos"],
  AYUNTAMIENTO: ["ayuntamiento"],
  PASEO_DE_LA_CRUZ: ["paseo de la cruz", "paseo cruz"],
  RINCON_DE_ROMOS: ["rincon de romos", "rincón de romos", "rincon romos"],
  JESUS_MARIA: ["jesus maria", "jesús maría", "jesus maria sucursal"],
  GONZALEZ_GALLO: ["gonzalez gallo", "gonzález gallo"],
  JUAN_PABLO: ["juan pablo"],
  GUADALUPE: ["guadalupe"],
  TLI: ["tli", "tienda en linea", "tienda en línea", "tienda online", "en linea", "online"],
};

const SUCURSAL_MATCH_DISTANCE = 3;

export function matchSucursal(text: string): Sucursal | null {
  const candidates = (Object.keys(SUCURSAL_ALIASES) as Sucursal[]).map((key) => ({
    key,
    aliases: SUCURSAL_ALIASES[key],
  }));
  return closestMatch(text, candidates, SUCURSAL_MATCH_DISTANCE) as Sucursal | null;
}

const FUENTE_ALIASES: Record<Fuente, string[]> = {
  FACEBOOK: ["facebook", "fb"],
  INSTAGRAM: ["instagram", "ig", "insta"],
  TIKTOK: ["tiktok", "tt", "tik tok"],
  WHATSAPP: ["whatsapp", "wa", "whats app"],
  SITIO_WEB: ["sitio web", "web", "pagina web", "página web", "sitio"],
  REFERIDO: ["referido", "referencia"],
  OTRO: ["otro", "otros"],
};

const FUENTE_MATCH_DISTANCE = 2;

export function matchFuente(text: string): Fuente | null {
  const candidates = (Object.keys(FUENTE_ALIASES) as Fuente[]).map((key) => ({
    key,
    aliases: FUENTE_ALIASES[key],
  }));
  return closestMatch(text, candidates, FUENTE_MATCH_DISTANCE) as Fuente | null;
}

export function isTruthyFlag(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const text = normalizeText(String(value));
  if (text === "") return false;
  return text === "1" || text === "x" || text === "si" || text === "sí" || text === "true";
}
