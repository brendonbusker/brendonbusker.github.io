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
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const hydrated = useRef(false);
  const valueRef = useRef(initial);
  useEffect(() => {
    let alive = true;
    window.clearTimeout(timer.current);
    hydrated.current = false;
    valueRef.current = initial;
    setValueState(initial);
    setState("idle");
    setLoading(true);
    draftsApi
      .get<T>(contentType, contentKey)
      .then(({ draft }) => {
        if (alive && draft) {
          valueRef.current = draft;
          setValueState(draft);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) {
          hydrated.current = true;
          setLoading(false);
          setRevision((current) => current + 1);
        }
      });
    return () => {
      alive = false;
    };
  }, [contentType, contentKey, initial]);
  const save = useCallback(
    async (next?: T) => {
      const payload = next ?? valueRef.current;
      setState("saving");
      try {
        await draftsApi.save({
          id: crypto.randomUUID(),
          contentType,
          contentKey,
          payload,
        });
        setState("saved");
      } catch {
        setState("error");
      }
    },
    [contentType, contentKey],
  );
  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      setValueState((current) => {
        const resolved =
          typeof next === "function" ? (next as (v: T) => T)(current) : next;
        valueRef.current = resolved;
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
  const reset = useCallback((next: T) => {
    window.clearTimeout(timer.current);
    valueRef.current = next;
    hydrated.current = true;
    setValueState(next);
    setState("idle");
    setLoading(false);
    setRevision((current) => current + 1);
  }, []);
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
    };
  }, [save, state]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { value, setValue, state, save, reset, loading, revision };
}
