import { cached, fetchJson } from "../cache";
import type { SourceAttempt, TickResponse } from "../types";

// Harga spot XAU/USD terkini (bid dan ask). Dipakai untuk menggerakkan candle terakhir
// di grafik setiap beberapa detik, di antara pembaruan data candle.

type SwissquoteEntry = {
  ts?: number;
  spreadProfilePrices?: { spreadProfile?: string; bid?: number; ask?: number }[];
};

type Live = Omit<TickResponse, "attempts" | "price"> & { price: number };

const ok = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

async function fromSwissquote(): Promise<Live> {
  const data = await fetchJson<SwissquoteEntry[]>(
    "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD",
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; xau-sentinel/1.0)" } },
    5000,
  );
  if (!Array.isArray(data)) throw new Error("Format kutipan tidak dikenali");
  // Ambil kutipan dengan spread paling sempit dari semua profil yang tersedia.
  let best: { bid: number; ask: number; ts: number } | null = null;
  for (const entry of data) {
    for (const p of entry.spreadProfilePrices ?? []) {
      if (!ok(p.bid) || !ok(p.ask) || p.ask < p.bid) continue;
      if (!best || p.ask - p.bid < best.ask - best.bid) {
        best = { bid: p.bid, ask: p.ask, ts: ok(entry.ts) ? entry.ts : Date.now() };
      }
    }
  }
  if (!best) throw new Error("Tidak ada kutipan bid/ask");
  return {
    price: (best.bid + best.ask) / 2,
    bid: best.bid,
    ask: best.ask,
    time: best.ts,
    source: "Swissquote",
  };
}

type GoldApi = { price?: number; updatedAt?: string };

async function fromGoldApi(): Promise<Live> {
  const data = await fetchJson<GoldApi>("https://api.gold-api.com/price/XAU", {}, 5000);
  if (!ok(data.price)) throw new Error("Respons tanpa harga");
  const t = data.updatedAt ? Date.parse(data.updatedAt) : NaN;
  return {
    price: data.price,
    bid: null,
    ask: null,
    time: Number.isFinite(t) ? t : Date.now(),
    source: "gold-api.com",
  };
}

async function load(): Promise<TickResponse> {
  const attempts: SourceAttempt[] = [];
  for (const [name, fn] of [
    ["Swissquote (bid/ask langsung)", fromSwissquote],
    ["gold-api.com", fromGoldApi],
  ] as const) {
    try {
      const tick = await fn();
      attempts.push({ name, ok: true, detail: `Harga spot ${tick.price.toFixed(2)}` });
      return { ...tick, attempts };
    } catch (err) {
      attempts.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  }
  return { price: null, bid: null, ask: null, time: Date.now(), source: null, attempts };
}

export async function getTick(): Promise<TickResponse> {
  const res = await cached("tick", 2000, load);
  return res.value;
}
