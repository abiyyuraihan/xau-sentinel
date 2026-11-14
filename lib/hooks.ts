"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Jam yang berdetak. null sebelum komponen terpasang di browser. */
export function useNow(everyMs: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

export type Polled<T> = {
  data: T | null;
  /** Data terakhir yang berhasil dimuat, termasuk dari URL sebelumnya */
  last: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
};

/** Mengambil JSON berulang kali. Berhenti saat tab disembunyikan. */
export function usePolling<T>(url: string, everyMs: number): Polled<T> {
  const [state, setState] = useState<{ url: string; data: T | null; error: string | null; loading: boolean }>({
    url,
    data: null,
    error: null,
    loading: true,
  });
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Server menjawab ${res.status}`);
      const data = (await res.json()) as T;
      if (mine === seq.current) setState({ url, data, error: null, loading: false });
    } catch (err) {
      if (mine === seq.current) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
          loading: false,
        }));
      }
    }
  }, [url]);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, everyMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, everyMs]);

  return {
    // Data dari URL lama tidak dipakai untuk URL baru.
    data: state.url === url ? state.data : null,
    last: state.data,
    error: state.error,
    loading: state.loading,
    refresh: load,
  };
}

// ───────── State yang disimpan di localStorage browser ─────────

const memory = new Map<string, { raw: string | null; value: unknown }>();
const listeners = new Map<string, Set<() => void>>();

function readStored<T>(key: string, initial: T): T {
  const hit = memory.get(key);
  if (hit) return hit.value as T;
  let raw: string | null = null;
  let value: T = initial;
  try {
    raw = localStorage.getItem(key);
    if (raw !== null) value = JSON.parse(raw) as T;
  } catch {
    // Penyimpanan diblokir atau isinya rusak: lanjut dengan nilai awal.
  }
  memory.set(key, { raw, value });
  return value;
}

function writeStored<T>(key: string, value: T) {
  const raw = JSON.stringify(value);
  memory.set(key, { raw, value });
  try {
    localStorage.setItem(key, raw);
  } catch {
    // Abaikan: nilai tetap hidup di memori selama tab terbuka.
  }
  listeners.get(key)?.forEach((fn) => fn());
}

export function useStored<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  // Nilai awal dibekukan supaya referensinya stabil di setiap render.
  const [frozen] = useState(initial);

  const subscribe = useCallback(
    (fn: () => void) => {
      let set = listeners.get(key);
      if (!set) listeners.set(key, (set = new Set()));
      set.add(fn);
      return () => {
        set.delete(fn);
      };
    },
    [key],
  );

  const value = useSyncExternalStore(
    subscribe,
    () => readStored(key, frozen),
    () => frozen,
  );

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = readStored(key, frozen);
      writeStored(key, typeof next === "function" ? (next as (p: T) => T)(prev) : next);
    },
    [key, frozen],
  );

  return [value, update];
}
