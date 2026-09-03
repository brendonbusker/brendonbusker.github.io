import { useCallback, useEffect, useRef, useState } from "react";
import { draftsApi } from "./api";
export type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";
export function useDraft<T>(
  contentType: string,
  contentKey: string,
  initial: T,
  sourceVersion = "",
) {
  const [value, setValueState] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const hydrated = useRef(false);
  const valueRef = useRef(initial);
  const initialRef = useRef(initial);
  const editVersion = useRef(0);
  const scopeVersion = useRef(0);
  initialRef.current = initial;
  useEffect(() => {
    let alive = true;
    const scope = ++scopeVersion.current;
    window.clearTimeout(timer.current);
    hydrated.current = false;
    editVersion.current = 0;
    valueRef.current = initialRef.current;
    setValueState(initialRef.current);
    setState("idle");
    setLoading(true);
    draftsApi
      .get<T>(contentType, contentKey)
      .then(({ draft }) => {
        if (alive && scope === scopeVersion.current && draft) {
          valueRef.current = draft;
          setValueState(draft);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive && scope === scopeVersion.current) {
          hydrated.current = true;
          setLoading(false);
          setRevision((current) => current + 1);
        }
      });
    return () => {
      alive = false;
    };
  }, [contentType, contentKey, sourceVersion]);
  const save = useCallback(
    async (next?: T) => {
      const payload = next ?? valueRef.current;
      const scope = scopeVersion.current;
      const version = editVersion.current;
      setState("saving");
      try {
        await draftsApi.save({
          id: crypto.randomUUID(),
          contentType,
          contentKey,
          payload,
        });
        if (scope === scopeVersion.current)
          setState(version === editVersion.current ? "saved" : "unsaved");
      } catch {
        if (scope === scopeVersion.current && version === editVersion.current)
          setState("error");
      }
    },
    [contentType, contentKey],
  );
  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      const resolved =
        typeof next === "function"
          ? (next as (v: T) => T)(valueRef.current)
          : next;
      valueRef.current = resolved;
      setValueState(resolved);
      if (hydrated.current) {
        editVersion.current += 1;
        setState("unsaved");
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void save(resolved), 1200);
      }
    },
    [save],
  );
  const reset = useCallback((next: T) => {
    scopeVersion.current += 1;
    editVersion.current = 0;
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
