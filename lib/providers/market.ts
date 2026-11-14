import { cached, fetchJson, forget } from "../cache";
import { getTick } from "./tick";
import { CANDLE_COUNT, INTERVALS } from "../config";
import type { Candle, Interval, MarketResponse, SourceAttempt } from "../types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

// ───────── Twelve Data: XAU/USD spot ─────────

type TwelveResponse = {
  status?: string;
  code?: number;
  message?: string;
  values?: { datetime: string; open: string; high: string; low: string; close: string }[];
};

async function fromTwelveData(interval: Interval, key: string): Promise<Candle[]> {
  const url =
    "https://api.twelvedata.com/time_series?symbol=XAU/USD" +
    `&interval=${interval}&outputsize=${CANDLE_COUNT}&timezone=UTC&apikey=${encodeURIComponent(key)}`;
  // Twelve Data menaruh penjelasan kesalahan di badan respons, jadi badan dibaca apa pun status HTTP-nya.
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  let data: TwelveResponse = {};
  try {
    data = (await res.json()) as TwelveResponse;
  } catch {
    throw new Error(`HTTP ${res.status}, respons bukan JSON`);
  }
  if (!res.ok || data.status === "error" || !data.values) {
    const code = data.code ?? res.status;
    const hint =
      code === 401
        ? "Kunci API ditolak. Salin ulang kunci dari dashboard Twelve Data, tanpa spasi atau tanda kutip."
        : code === 429
          ? "Kuota habis (8 per menit, 800 per hari)."
          : "";
    throw new Error(`HTTP ${code}. ${hint} ${data.message ?? ""}`.replace(/\*\*/g, "").trim());
  }
  const candles = data.values
    .map((v) => {
      const iso = v.datetime.includes(" ") ? v.datetime.replace(" ", "T") + "Z" : v.datetime + "T00:00:00Z";
      return {
        time: Math.floor(Date.parse(iso) / 1000),
        open: Number(v.open),
        high: Number(v.high),
        low: Number(v.low),
        close: Number(v.close),
      };
    })
    .filter((c) => isNum(c.time) && isNum(c.open) && isNum(c.high) && isNum(c.low) && isNum(c.close))
    .sort((a, b) => a.time - b.time);
  if (candles.length < 20) throw new Error("Data terlalu sedikit");
  return candles;
}

// ───────── Yahoo Finance: kontrak berjangka emas (GC=F), bukan spot ─────────

type YahooResponse = {
  chart?: {
    error?: { description?: string } | null;
    result?: {
      timestamp?: number[];
      indicators?: {
        quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }[];
      };
    }[];
  };
};

const YAHOO: Record<Interval, { interval: string; range: string; group?: number }> = {
  "5min": { interval: "5m", range: "5d" },
  "15min": { interval: "15m", range: "10d" },
  "1h": { interval: "60m", range: "1mo" },
  "4h": { interval: "60m", range: "3mo", group: 14400 },
  "1day": { interval: "1d", range: "2y" },
};

function regroup(candles: Candle[], seconds: number): Candle[] {
  const out: Candle[] = [];
  for (const c of candles) {
    const bucket = Math.floor(c.time / seconds) * seconds;
    const cur = out[out.length - 1];
    if (cur && cur.time === bucket) {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
    } else {
      out.push({ ...c, time: bucket });
    }
  }
  return out;
}

async function fromYahoo(interval: Interval): Promise<Candle[]> {
  const cfg = YAHOO[interval];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=${cfg.interval}&range=${cfg.range}`;
  const data = await fetchJson<YahooResponse>(url, { headers: { "User-Agent": UA } });
  const result = data.chart?.result?.[0];
  const q = result?.indicators?.quote?.[0];
  const ts = result?.timestamp;
  if (!result || !q || !ts) {
    throw new Error(data.chart?.error?.description ?? "Respons tanpa data");
  }
  let candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    if (isNum(o) && isNum(h) && isNum(l) && isNum(c)) {
      candles.push({ time: ts[i], open: o, high: h, low: l, close: c });
    }
  }
  if (cfg.group) candles = regroup(candles, cfg.group);
  if (candles.length < 20) throw new Error("Data terlalu sedikit");
  return candles.slice(-CANDLE_COUNT);
}

// ───────── Data simulasi ─────────
// Hanya supaya tampilan bisa dicoba tanpa kunci API. Bukan harga pasar.

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulated(interval: Interval): Candle[] {
  const seconds = INTERVALS.find((i) => i.id === interval)!.seconds;
  const nowBucket = Math.floor(Date.now() / 1000 / seconds);
  const start = nowBucket - CANDLE_COUNT + 1;
  const vol = 0.9 * Math.sqrt(seconds / 300);
  let price = 4300 + 70 * Math.sin(start / 180) + 40 * Math.sin(start / 47);
  const out: Candle[] = [];
  for (let b = start; b <= nowBucket; b++) {
    const rnd = mulberry32(b * 2654435761 + seconds);
    const drift = Math.sin(b / 60) * vol * 0.15;
    const open = price;
    const close = open + drift + (rnd() - 0.5) * 2 * vol;
    const high = Math.max(open, close) + rnd() * vol * 0.8;
    const low = Math.min(open, close) - rnd() * vol * 0.8;
    out.push({ time: b * seconds, open, high, low, close });
    price = close;
  }
  return out;
}

// ───────── Rantai penyedia ─────────

type Loaded = Pick<MarketResponse, "candles" | "source" | "label" | "attempts" | "basis">;

/** Menggeser candle futures dengan selisih tetap supaya harga terakhirnya sama dengan spot. */
async function alignToSpot(candles: Candle[]): Promise<{ candles: Candle[]; basis: number }> {
  try {
    const tick = await getTick();
    const lastBar = candles[candles.length - 1];
    if (tick.price === null || !lastBar) return { candles, basis: 0 };
    const basis = tick.price - lastBar.close;
    // Selisih futures dan spot wajarnya kecil. Di luar batas ini, lebih aman tidak menggeser.
    if (Math.abs(basis) > lastBar.close * 0.03) return { candles, basis: 0 };
    return {
      basis,
      candles: candles.map((c) => ({
        time: c.time,
        open: c.open + basis,
        high: c.high + basis,
        low: c.low + basis,
        close: c.close + basis,
      })),
    };
  } catch {
    return { candles, basis: 0 };
  }
}

async function load(interval: Interval): Promise<Loaded> {
  const attempts: SourceAttempt[] = [];
  const key = process.env.TWELVEDATA_API_KEY?.trim().replace(/^["']|["']$/g, "");

  if (key) {
    try {
      const candles = await fromTwelveData(interval, key);
      attempts.push({ name: "Twelve Data", ok: true, detail: `${candles.length} candle XAU/USD spot` });
      return { candles, source: "twelvedata", label: "XAU/USD spot", attempts, basis: 0 };
    } catch (err) {
      attempts.push({ name: "Twelve Data", ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  } else {
    attempts.push({ name: "Twelve Data", ok: false, detail: "TWELVEDATA_API_KEY belum diisi" });
  }

  try {
    const raw = await fromYahoo(interval);
    const { candles, basis } = await alignToSpot(raw);
    attempts.push({
      name: "Yahoo Finance",
      ok: true,
      detail:
        basis !== 0
          ? `${candles.length} candle GC=F (futures), digeser ${basis >= 0 ? "+" : ""}${basis.toFixed(2)} ke harga spot`
          : `${candles.length} candle GC=F (futures), tidak digeser`,
    });
    return {
      candles,
      source: "yahoo",
      label: basis !== 0 ? "GC=F digeser ke spot (perkiraan)" : "Gold futures GC=F",
      attempts,
      basis,
    };
  } catch (err) {
    attempts.push({ name: "Yahoo Finance", ok: false, detail: err instanceof Error ? err.message : String(err) });
  }

  attempts.push({ name: "Data simulasi", ok: true, detail: "Semua sumber harga gagal, memakai data buatan" });
  return { candles: simulated(interval), source: "demo", label: "Simulasi", attempts, basis: 0 };
}

export async function getMarket(interval: Interval): Promise<MarketResponse> {
  const ttl = INTERVALS.find((i) => i.id === interval)!.ttlMs;
  const cacheKey = `market:${interval}`;
  const res = await cached(cacheKey, ttl, async () => {
    const loaded = await load(interval);
    return { ...loaded, fetchedAt: Date.now() };
  });
  // Data simulasi tidak ditahan: sumber asli dicoba lagi di permintaan berikutnya.
  if (res.value.source === "demo") forget(cacheKey);
  return { interval, ...res.value };
}
