export type Publication = {
  id: string;
  version?: string;
  publicUrl?: string;
  state:
    | "publishing"
    | "waiting"
    | "building"
    | "retrying"
    | "live"
    | "failed"
    | "cancelled"
    | "unavailable";
  message: string;
  detailsUrl?: string;
};
const key = "cms-latest-publication";
function restore(): Publication | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (
      saved &&
      typeof saved.id === "string" &&
      /^[a-f0-9]{40}$/i.test(saved.version) &&
      typeof saved.publicUrl === "string" &&
      saved.publicUrl.startsWith("https://")
    )
      return {
        id: saved.id,
        version: saved.version,
        publicUrl: saved.publicUrl,
        state: "waiting",
        message: "Checking your latest publication…",
      };
    if (saved && typeof saved.id === "string")
      return {
        id: saved.id,
        state: "unavailable",
        message:
          "The last publication was not confirmed before the page closed. Reload the published content before trying again.",
      };
  } catch {
    /* Storage is optional. */
  }
  return null;
}
let publication = restore();
const listeners = new Set<() => void>();
export const publishing = {
  get: () => publication,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  set: (next: Publication | null) => {
    publication = next;
    try {
      if (next) localStorage.setItem(key, JSON.stringify(next));
      else if (!next) localStorage.removeItem(key);
    } catch {
      /* The banner still works without browser storage. */
    }
    listeners.forEach((listener) => listener());
  },
  update: (id: string, patch: Partial<Publication>) => {
    if (publication?.id === id) publishing.set({ ...publication, ...patch });
  },
};
