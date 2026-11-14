import type { Candle } from "./types";
import { atr, bollinger, ema, last, macd, nthFromEnd, rsi } from "./indicators";

export type Verdict = -1 | 0 | 1;

export type Reading = {
  name: string;
  value: string;
  verdict: Verdict;
  text: string;
};

export type TechnicalSummary = {
  ready: boolean;
  /** -100 (sangat bearish) sampai +100 (sangat bullish) */
  score: number;
  readings: Reading[];
  price: number;
  atr: number | null;
  rsi: number | null;
  support: number | null;
  resistance: number | null;
};

const f2 = (n: number) => n.toFixed(2);

export function analyzeTechnical(candles: Candle[]): TechnicalSummary {
  const price = candles.length ? candles[candles.length - 1].close : 0;
  if (candles.length < 60) {
    return {
      ready: false,
      score: 0,
      readings: [],
      price,
      atr: null,
      rsi: null,
      support: null,
      resistance: null,
    };
  }

  const closes = candles.map((c) => c.close);
  const e20 = last(ema(closes, 20));
  const e50 = last(ema(closes, 50));
  const e200 = last(ema(closes, 200));
  const rsiSeries = rsi(closes, 14);
  const r = last(rsiSeries);
  const m = macd(closes);
  const hist = last(m.hist);
  const histPrev = nthFromEnd(m.hist, 1);
  const bb = bollinger(closes, 20, 2);
  const bbU = last(bb.upper);
  const bbL = last(bb.lower);
  const a = last(atr(candles, 14));

  const readings: Reading[] = [];

  if (e20 !== null && e50 !== null) {
    const v: Verdict = e20 > e50 ? 1 : e20 < e50 ? -1 : 0;
    readings.push({
      name: "Tren pendek (EMA 20 vs 50)",
      value: `${f2(e20)} / ${f2(e50)}`,
      verdict: v,
      text: v > 0 ? "EMA 20 di atas EMA 50" : v < 0 ? "EMA 20 di bawah EMA 50" : "Berimpit",
    });
  }

  if (e50 !== null && e200 !== null) {
    const v: Verdict = e50 > e200 ? 1 : e50 < e200 ? -1 : 0;
    readings.push({
      name: "Tren besar (EMA 50 vs 200)",
      value: `${f2(e50)} / ${f2(e200)}`,
      verdict: v,
      text: v > 0 ? "Struktur naik" : v < 0 ? "Struktur turun" : "Berimpit",
    });
  }

  if (e50 !== null) {
    const v: Verdict = price > e50 ? 1 : price < e50 ? -1 : 0;
    readings.push({
      name: "Harga vs EMA 50",
      value: f2(price - e50),
      verdict: v,
      text: v > 0 ? "Harga di atas rata-rata" : v < 0 ? "Harga di bawah rata-rata" : "Tepat di rata-rata",
    });
  }

  if (r !== null) {
    let v: Verdict = 0;
    let text = "Netral (45–55)";
    if (r >= 70) {
      v = 0;
      text = "Jenuh beli: momentum kuat, rawan koreksi";
    } else if (r <= 30) {
      v = 0;
      text = "Jenuh jual: momentum lemah, rawan pantulan";
    } else if (r > 55) {
      v = 1;
      text = "Momentum naik";
    } else if (r < 45) {
      v = -1;
      text = "Momentum turun";
    }
    readings.push({ name: "RSI 14", value: r.toFixed(1), verdict: v, text });
  }

  if (hist !== null && histPrev !== null) {
    const rising = hist > histPrev;
    let v: Verdict = 0;
    if (hist > 0 && rising) v = 1;
    else if (hist < 0 && !rising) v = -1;
    readings.push({
      name: "MACD (12, 26, 9)",
      value: hist.toFixed(2),
      verdict: v,
      text:
        v > 0
          ? "Histogram positif dan membesar"
          : v < 0
            ? "Histogram negatif dan membesar"
            : hist > 0
              ? "Positif tapi melemah"
              : "Negatif tapi melemah",
    });
  }

  if (bbU !== null && bbL !== null && bbU > bbL) {
    const pos = (price - bbL) / (bbU - bbL);
    let v: Verdict = 0;
    let text = "Di tengah pita";
    if (pos > 1) {
      v = 1;
      text = "Menembus pita atas";
    } else if (pos < 0) {
      v = -1;
      text = "Menembus pita bawah";
    } else if (pos > 0.65) {
      v = 1;
      text = "Di paruh atas pita";
    } else if (pos < 0.35) {
      v = -1;
      text = "Di paruh bawah pita";
    }
    readings.push({
      name: "Bollinger (20, 2)",
      value: `${Math.round(pos * 100)}%`,
      verdict: v,
      text,
    });
  }

  const window = candles.slice(-61, -1);
  const support = Math.min(...window.map((c) => c.low));
  const resistance = Math.max(...window.map((c) => c.high));

  const sum = readings.reduce((s, x) => s + x.verdict, 0);
  const score = readings.length ? Math.round((sum / readings.length) * 100) : 0;

  return {
    ready: true,
    score,
    readings,
    price,
    atr: a,
    rsi: r,
    support,
    resistance,
  };
}
