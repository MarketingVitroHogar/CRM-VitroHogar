const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = new Array(n + 1);
  let currRow = new Array(n + 1);
  for (let j = 0; j <= n; j++) prevRow[j] = j;

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost // substitution
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }
  return prevRow[n];
}

/** Best match from `candidates` for `input`, or null if nothing clears the distance threshold. */
export function closestMatch(
  input: string,
  candidates: { key: string; aliases: string[] }[],
  maxDistance: number
): string | null {
  const normalizedInput = normalizeText(input);
  if (!normalizedInput) return null;

  // exact alias match first
  for (const candidate of candidates) {
    if (candidate.aliases.some((alias) => normalizeText(alias) === normalizedInput)) {
      return candidate.key;
    }
  }

  // fallback: fuzzy match against every alias, keep the closest overall
  let best: { key: string; distance: number } | null = null;
  for (const candidate of candidates) {
    for (const alias of candidate.aliases) {
      const distance = levenshtein(normalizedInput, normalizeText(alias));
      if (best === null || distance < best.distance) {
        best = { key: candidate.key, distance };
      }
    }
  }

  if (best && best.distance <= maxDistance) return best.key;
  return null;
}
