/** Ignore case, accents and punctuation while matching each word in a query. */
export function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function matchesSearch(text: string, query: string) {
  return normalizeSearch(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}
