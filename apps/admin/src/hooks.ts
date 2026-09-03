import { useCallback, useEffect, useRef, useState } from "react";
import { draftsApi } from "./api";
export type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";
export function useDraft<T>(
  contentType: string,
  contentKey: string,
  initial: T,
) {
  const [value, setValueState] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<number | undefined>(undefined);
  const hydrated = useRef(false);
  useEffect(() => {
    let alive = true;
    hydrated.current = false;
    setValueState(initial);
    setState("idle");
    draftsApi
      .get<T>(contentType, contentKey)
      .then(({ draft }) => {
        if (alive && draft) setValueState(draft);
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true;
      });
    return () => {
      alive = false;
    };
  }, [contentType, contentKey, initial]);
  const save = useCallback(
    async (next = value) => {
      setState("saving");
      try {
        await draftsApi.save({
          id: crypto.randomUUID(),
          contentType,
          contentKey,
          payload: next,
        });
        setState("saved");
      } catch {
        setState("error");
      }
    },
    [contentType, contentKey, value],
  );
  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      setValueState((current) => {
        const resolved =
          typeof next === "function" ? (next as (v: T) => T)(current) : next;
        if (hydrated.current) {
          setState("unsaved");
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => void save(resolved), 1200);
        }
        return resolved;
      });
    },
    [save],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    const before = (e: BeforeUnloadEvent) => {
      if (state === "unsaved" || state === "saving") e.preventDefault();
    };
    addEventListener("keydown", onKey);
    addEventListener("beforeunload", before);
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("beforeunload", before);
      window.clearTimeout(timer.current);
    };
  }, [save, state]);
  return { value, setValue, state, save };
}
