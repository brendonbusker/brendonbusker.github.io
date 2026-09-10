import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it("ignores an older publish response after a newer request and survives unavailable storage", async () => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {
      throw new Error("Storage blocked");
    },
  });
  const { publishing } = await import("./publishing");
  publishing.set({ id: "old", state: "publishing", message: "First" });
  publishing.set({ id: "new", state: "publishing", message: "Second" });
  publishing.update("old", { state: "live", version: "a".repeat(40) });
  expect(publishing.get()).toMatchObject({ id: "new", state: "publishing" });
  publishing.update("new", { state: "waiting", version: "b".repeat(40) });
  expect(publishing.get()?.version).toBe("b".repeat(40));
});
it("rechecks saved versions after refresh and never calls an interrupted request live", async () => {
  let saved = JSON.stringify({
    id: "saved",
    version: "a".repeat(40),
    publicUrl: "https://site.example.com/blog/",
    state: "live",
  });
  vi.stubGlobal("localStorage", { getItem: () => saved });
  const first = await import("./publishing");
  expect(first.publishing.get()?.state).toBe("waiting");
  saved = JSON.stringify({ id: "interrupted", state: "publishing" });
  vi.resetModules();
  const second = await import("./publishing");
  expect(second.publishing.get()).toMatchObject({
    state: "unavailable",
    id: "interrupted",
  });
});
