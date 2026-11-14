import type { Candle, Interval, MarketSource } from "./types";

export type JournalEntry = {
  id: string;
  /** Unix milidetik */
  at: number;
  mode: string;
  action: "BELI" | "JUAL";
  entry: number;
  stop: number;
  tp1: number;
  tp2: number;
  score: number;
  interval: Interval;
  source: MarketSource;
  result: "TP1" | "SL" | null;
  /** Unix milidetik saat target atau stop tersentuh */
  resolvedAt?: number;
  /** true bila dicatat otomatis oleh dashboard */
  auto?: boolean;
};

/** Boleh mencatat otomatis bila tidak ada catatan searah yang masih terbuka atau baru saja ditutup. */
export function canAutoLog(
  entries: JournalEntry[],
  action: "BELI" | "JUAL",
  now: number,
  cooldownMs: number,
): boolean {
  return !entries.some(
    (e) => e.action === action && (e.result === null || now - (e.resolvedAt ?? e.at) < cooldownMs),
  );
}

/**
 * Memeriksa candle setelah catatan dibuat: mana yang tersentuh lebih dulu, target 1 atau stop.
 * Bila keduanya tersentuh di candle yang sama, dianggap stop (asumsi terburuk).
 */
export function evaluate(e: JournalEntry, candles: Candle[]): "TP1" | "SL" | null {
  for (const c of candles) {
    if (c.time * 1000 < e.at) continue;
    const hitStop = e.action === "BELI" ? c.low <= e.stop : c.high >= e.stop;
    const hitTarget = e.action === "BELI" ? c.high >= e.tp1 : c.low <= e.tp1;
    if (hitStop) return "SL";
    if (hitTarget) return "TP1";
  }
  return null;
}

export function toCsv(entries: JournalEntry[]): string {
  const head = "waktu,mode,arah,acuan,stop,target1,target2,skor,timeframe,sumber,hasil,waktu_hasil,pencatatan";
  const rows = entries.map((e) =>
    [
      new Date(e.at).toISOString(),
      e.mode,
      e.action,
      e.entry.toFixed(2),
      e.stop.toFixed(2),
      e.tp1.toFixed(2),
      e.tp2.toFixed(2),
      e.score,
      e.interval,
      e.source,
      e.result ?? "terbuka",
      e.resolvedAt ? new Date(e.resolvedAt).toISOString() : "",
      e.auto ? "otomatis" : "manual",
    ].join(","),
  );
  return [head, ...rows].join("\n");
}
