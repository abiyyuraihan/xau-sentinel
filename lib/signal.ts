import { SIGNAL } from "./config";
import { atr, last } from "./indicators";
import type { TechnicalSummary } from "./technical";
import type { CalendarEvent, Candle, NewsItem } from "./types";

// ───────── Tekanan berita ─────────

export type NewsPressure = {
  /** Jumlah skor judul, tiap judul meluruh seiring umur */
  pressure: number;
  /** -100 sampai +100 untuk emas */
  score: number;
  /** Judul baru dengan skor tinggi */
  candidates: NewsItem[];
  /** Jumlah sumber berbeda yang searah dengan tekanan */
  sources: number;
};

export function newsPressure(items: NewsItem[], now: number): NewsPressure {
  const half = SIGNAL.newsHalfLifeMinutes * 60_000;
  let pressure = 0;
  for (const it of items) {
    const age = now - it.publishedAt;
    if (age < 0 || age > 3 * 3600_000 || it.score === 0) continue;
    pressure += it.score * Math.pow(0.5, age / half);
  }
  const dir = Math.sign(pressure);
  const windowMs = SIGNAL.breakingWindowMinutes * 60_000;
  const candidates = items
    .filter(
      (it) =>
        now - it.publishedAt >= 0 &&
        now - it.publishedAt <= windowMs &&
        Math.abs(it.score) >= 3 &&
        Math.sign(it.score) === dir,
    )
    .sort((a, b) => b.publishedAt - a.publishedAt);
  const sources = new Set(candidates.map((c) => c.source)).size;
  const score = Math.round(Math.max(-1, Math.min(1, pressure / 8)) * 100);
  return { pressure: Math.round(pressure * 10) / 10, score, candidates, sources };
}

// ───────── Gerak harga tak wajar ─────────

export type PriceShock = {
  active: boolean;
  dir: -1 | 0 | 1;
  /** Pergerakan 3 candle terakhir dibagi ATR */
  multiple: number;
  move: number;
};

export function priceShock(candles: Candle[]): PriceShock {
  const none: PriceShock = { active: false, dir: 0, multiple: 0, move: 0 };
  if (candles.length < 30) return none;
  // ATR dihitung tanpa 3 candle terakhir supaya lonjakan tidak menaikkan pembandingnya sendiri.
  const base = last(atr(candles.slice(0, -3), 14));
  if (!base) return none;
  const n = candles.length;
  const move = candles[n - 1].close - candles[n - 4].close;
  const multiple = Math.abs(move) / base;
  return {
    active: multiple >= SIGNAL.shockAtrMultiple,
    dir: move > 0 ? 1 : move < 0 ? -1 : 0,
    multiple: Math.round(multiple * 10) / 10,
    move,
  };
}

// ───────── Status breaking ─────────

export type BreakingLevel = "tenang" | "pantau" | "siaga";

export type Breaking = {
  level: BreakingLevel;
  dir: -1 | 0 | 1;
  reason: string;
};

export function breakingState(np: NewsPressure, shock: PriceShock): Breaking {
  const abs = Math.abs(np.pressure);
  const dir = (Math.sign(np.pressure) || 0) as -1 | 0 | 1;
  const side = dir > 0 ? "mendukung emas" : "menekan emas";

  if (abs >= SIGNAL.pressureAlert && np.sources >= 2) {
    return {
      level: "siaga",
      dir,
      reason: `${np.candidates.length} judul berbobot tinggi dari ${np.sources} sumber berbeda ${side}.`,
    };
  }
  if (abs >= SIGNAL.pressureAlertWithShock && shock.active && shock.dir === dir) {
    return {
      level: "siaga",
      dir,
      reason: `Berita ${side} dan harga bergerak ${shock.multiple}× ATR ke arah yang sama.`,
    };
  }
  if (abs >= SIGNAL.pressureWatch) {
    return { level: "pantau", dir, reason: `Arus berita mulai ${side}, belum cukup kuat untuk siaga.` };
  }
  if (shock.active) {
    return {
      level: "pantau",
      dir: 0,
      reason: `Harga bergerak ${shock.multiple}× ATR tanpa berita yang terdeteksi. Periksa sumber berita secara manual.`,
    };
  }
  return { level: "tenang", dir: 0, reason: "Tidak ada anomali berita maupun harga." };
}

// ───────── Sinyal gabungan ─────────

export type SurpriseEntry = {
  eventId: string;
  title: string;
  actual: string;
  forecast: string;
  score: number;
  /** Unix milidetik saat hasil dimasukkan */
  at: number;
};

export type Mode = "teknikal" | "rilis" | "breaking" | "siaga-rilis";
export type Action = "BELI" | "JUAL" | "TUNGGU";

export type Composite = {
  mode: Mode;
  action: Action;
  /** -100 sampai +100 */
  score: number;
  confidence: number;
  parts: { technical: number; event: number | null; news: number };
  weights: { technical: number; event: number; news: number };
  entry: number;
  stop: number | null;
  tp1: number | null;
  tp2: number | null;
  headline: string;
  detail: string;
  nextEvent: CalendarEvent | null;
};

export function nextHighImpact(events: CalendarEvent[], now: number): CalendarEvent | null {
  return (
    events
      .filter((e) => e.country === "USD" && e.impact === "High" && e.time > now)
      .sort((a, b) => a.time - b.time)[0] ?? null
  );
}

export function composeSignal(args: {
  technical: TechnicalSummary;
  news: NewsPressure;
  breaking: Breaking;
  surprise: SurpriseEntry | null;
  events: CalendarEvent[];
  now: number;
}): Composite {
  const { technical, news, breaking, events, now } = args;
  const surprise =
    args.surprise && now - args.surprise.at <= SIGNAL.surpriseValidMinutes * 60_000
      ? args.surprise
      : null;

  const upcoming = nextHighImpact(events, now);
  const minutesTo = upcoming ? (upcoming.time - now) / 60_000 : Infinity;

  let weights = { technical: 0.6, event: 0, news: 0.4 };
  let mode: Mode = "teknikal";
  if (surprise) {
    weights = { technical: 0.3, event: 0.45, news: 0.25 };
    mode = "rilis";
  }
  if (breaking.level === "siaga") {
    weights = surprise
      ? { technical: 0.25, event: 0.3, news: 0.45 }
      : { technical: 0.4, event: 0, news: 0.6 };
    mode = "breaking";
  }

  const parts = {
    technical: technical.score,
    event: surprise ? surprise.score : null,
    news: news.score,
  };
  const score = Math.round(
    parts.technical * weights.technical +
      (parts.event ?? 0) * weights.event +
      parts.news * weights.news,
  );

  let action: Action = "TUNGGU";
  if (score >= SIGNAL.entryThreshold) action = "BELI";
  else if (score <= -SIGNAL.entryThreshold) action = "JUAL";

  const standby = !surprise && minutesTo <= SIGNAL.standbyMinutesBefore;
  if (standby) {
    mode = "siaga-rilis";
    action = "TUNGGU";
  }

  const entry = technical.price;
  const a = technical.atr;
  const sign = action === "BELI" ? 1 : action === "JUAL" ? -1 : 0;
  const stop = a && sign ? entry - sign * SIGNAL.slAtr * a : null;
  const tp1 = a && sign ? entry + sign * SIGNAL.tp1Atr * a : null;
  const tp2 = a && sign ? entry + sign * SIGNAL.tp2Atr * a : null;

  let headline: string;
  let detail: string;
  if (standby && upcoming) {
    headline = "Tahan dulu";
    detail = `${upcoming.title} rilis kurang dari ${SIGNAL.standbyMinutesBefore} menit lagi. Spread melebar dan arah belum bisa diketahui. Siapkan skenario, masukkan angka aktual begitu keluar.`;
  } else if (action === "TUNGGU") {
    headline = "Belum ada arah";
    detail = `Skor gabungan ${score} masih di bawah ambang ${SIGNAL.entryThreshold}. Faktor-faktornya belum searah.`;
  } else {
    headline = action === "BELI" ? "Bias beli" : "Bias jual";
    const src =
      mode === "breaking"
        ? "didorong arus berita"
        : mode === "rilis"
          ? "didorong hasil rilis data"
          : "dari pembacaan teknikal dan berita";
    detail = `Skor gabungan ${score}, ${src}. Level di bawah dihitung dari ATR, bukan dari struktur harga.`;
  }

  return {
    mode,
    action,
    score,
    confidence: Math.min(100, Math.abs(score)),
    parts,
    weights,
    entry,
    stop,
    tp1,
    tp2,
    headline,
    detail,
    nextEvent: upcoming,
  };
}
