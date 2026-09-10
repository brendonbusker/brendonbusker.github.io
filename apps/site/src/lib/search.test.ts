import { expect, it } from "vitest";
import { normalizeSearch, matchesSearch } from "./search";

it("matches all words regardless of case, accents, punctuation or order", () => {
  const text = normalizeSearch("Pokémon projects: a self-rule & résumé.");
  expect(matchesSearch(text, "  RÉSUMÉ   pokemon ")).toBe(true);
  expect(matchesSearch(text, "self rule")).toBe(true);
  expect(matchesSearch(text, "pokemon missing")).toBe(false);
  expect(matchesSearch(text, "   ")).toBe(true);
  expect(matchesSearch(text, "[.*]")).toBe(true);
  expect(matchesSearch(normalizeSearch("東京で作る"), "東京")).toBe(true);
});
