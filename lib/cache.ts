// Cache memori sederhana per instance server.
// Tujuannya menjaga kuota API gratis: banyak permintaan dari browser
// hanya menghasilkan satu panggilan ke penyedia data per jendela waktu.

type Entry = { at: number; value: unknown };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export type Cached<T> = { value: T; stale: boolean; error?: string };

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<Cached<T>> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return { value: hit.value as T, stale: false };
  }

  let job = inflight.get(key) as Promise<T> | undefined;
  if (!job) {
    job = load().finally(() => inflight.delete(key));
    inflight.set(key, job);
  }

  try {
    const value = await job;
    store.set(key, { at: Date.now(), value });
    return { value, stale: false };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    // Kalau penyedia gagal tapi masih ada data lama, pakai data lama dan beri tanda.
    if (hit) return { value: hit.value as T, stale: true, error };
    throw new Error(error);
  }
}

export function forget(key: string) {
  store.delete(key);
}

export async function fetchText(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<string> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<T> {
  const text = await fetchText(url, init, timeoutMs);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Respons bukan JSON yang valid");
  }
}
