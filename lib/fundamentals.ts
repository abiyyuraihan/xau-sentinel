import type { CalendarEvent, OfficialKey } from "./types";

// Aturan arah untuk rilis data AS.
// goldWhenHigher: arah emas bila angka aktual LEBIH TINGGI dari perkiraan.
//   -1 → data kuat/inflasi tinggi → dolar & yield cenderung naik → emas tertekan
//   +1 → data lemah (mis. pengangguran naik) → ekspektasi pemangkasan suku bunga → emas terdukung
// threshold: selisih yang dianggap "kejutan penuh" (satuan mengikuti data).
// Ini aturan umum buku teks, bukan jaminan. Reaksi nyata sering berbalik arah.

export type EventRule = {
  id: string;
  match: RegExp;
  goldWhenHigher: -1 | 1;
  threshold: number;
  official?: OfficialKey;
  why: string;
};

export const EVENT_RULES: EventRule[] = [
  {
    id: "core_cpi_mm",
    match: /core cpi m\/m/i,
    goldWhenHigher: -1,
    threshold: 0.1,
    official: "core_cpi_mm",
    why: "Inflasi inti di atas perkiraan mengurangi peluang pemangkasan suku bunga.",
  },
  {
    id: "cpi_yy",
    match: /^cpi y\/y/i,
    goldWhenHigher: -1,
    threshold: 0.1,
    official: "cpi_yy",
    why: "Inflasi tahunan di atas perkiraan mendorong yield dan dolar.",
  },
  {
    id: "cpi_mm",
    match: /^cpi m\/m/i,
    goldWhenHigher: -1,
    threshold: 0.1,
    official: "cpi_mm",
    why: "Inflasi bulanan di atas perkiraan mendorong yield dan dolar.",
  },
  {
    id: "pce",
    match: /pce price/i,
    goldWhenHigher: -1,
    threshold: 0.1,
    why: "PCE adalah ukuran inflasi pilihan The Fed.",
  },
  {
    id: "ppi",
    match: /^ppi m\/m/i,
    goldWhenHigher: -1,
    threshold: 0.2,
    official: "ppi_mm",
    why: "Harga produsen di atas perkiraan memberi sinyal tekanan inflasi.",
  },
  {
    id: "core_cpi_yy",
    match: /^core cpi y\/y/i,
    goldWhenHigher: -1,
    threshold: 0.1,
    official: "core_cpi_yy",
    why: "Inflasi inti tahunan di atas perkiraan mengurangi peluang pemangkasan suku bunga.",
  },
  {
    id: "core_ppi",
    match: /^core ppi m\/m/i,
    goldWhenHigher: -1,
    threshold: 0.2,
    why: "Harga produsen inti di atas perkiraan memberi sinyal tekanan inflasi.",
  },
  {
    id: "ahe",
    match: /average hourly earnings/i,
    goldWhenHigher: -1,
    threshold: 0.1,
    official: "ahe_mm",
    why: "Upah naik lebih cepat berarti tekanan inflasi dari sisi tenaga kerja.",
  },
  {
    id: "nfp",
    match: /non-farm employment change/i,
    goldWhenHigher: -1,
    threshold: 50_000,
    official: "nfp",
    why: "Lapangan kerja kuat mengurangi alasan The Fed untuk melonggarkan kebijakan.",
  },
  {
    id: "adp",
    match: /adp .*employment/i,
    goldWhenHigher: -1,
    threshold: 40_000,
    why: "ADP sering dibaca sebagai petunjuk awal NFP.",
  },
  {
    id: "unemp",
    match: /unemployment rate/i,
    goldWhenHigher: 1,
    threshold: 0.1,
    official: "unemp",
    why: "Pengangguran naik memperbesar peluang pemangkasan suku bunga.",
  },
  {
    id: "claims",
    match: /unemployment claims/i,
    goldWhenHigher: 1,
    threshold: 15_000,
    why: "Klaim pengangguran naik menandakan pasar kerja melemah.",
  },
  {
    id: "ffr",
    match: /federal funds rate/i,
    goldWhenHigher: -1,
    threshold: 0.25,
    why: "Suku bunga lebih tinggi menaikkan biaya memegang emas.",
  },
  {
    id: "retail",
    match: /retail sales/i,
    goldWhenHigher: -1,
    threshold: 0.3,
    why: "Belanja konsumen kuat mendukung dolar.",
  },
  {
    id: "gdp",
    match: /gdp q\/q/i,
    goldWhenHigher: -1,
    threshold: 0.3,
    why: "Pertumbuhan di atas perkiraan mendukung dolar.",
  },
  {
    id: "ism",
    match: /ism (manufacturing|services) pmi/i,
    goldWhenHigher: -1,
    threshold: 1,
    why: "Aktivitas bisnis kuat mendukung dolar.",
  },
  {
    id: "jolts",
    match: /jolts/i,
    goldWhenHigher: -1,
    threshold: 300_000,
    why: "Lowongan kerja tinggi menandakan pasar kerja ketat.",
  },
  {
    id: "sentiment",
    match: /consumer (sentiment|confidence)/i,
    goldWhenHigher: -1,
    threshold: 2.5,
    why: "Keyakinan konsumen tinggi mendukung dolar.",
  },
];

const QUALITATIVE = /fomc|fed chair|powell|press conference|speaks|testifies|minutes|statement/i;

export function ruleFor(title: string): EventRule | null {
  return EVENT_RULES.find((r) => r.match.test(title)) ?? null;
}

export function isQualitative(title: string): boolean {
  return QUALITATIVE.test(title) && !ruleFor(title);
}

const SCALE: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

export type Parsed = { value: number; suffix: string };

/** Membaca "0.3%", "115K", "-92K", "1.37M", "4.50%", "$-308B", "<0.1%" */
export function parseFigure(raw: string): Parsed | null {
  if (!raw) return null;
  const s = raw.replace(/[,\s$<>]/g, "").toUpperCase();
  const m = s.match(/^(-?\d+(?:\.\d+)?)([KMBT%]?)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const suffix = m[2];
  return { value: n * (SCALE[suffix] ?? 1), suffix };
}

export type Surprise = {
  /** aktual − perkiraan, dalam satuan dasar */
  diff: number;
  /** -100 sampai +100 untuk emas */
  score: number;
  verdict: "bullish" | "bearish" | "netral";
  text: string;
};

export function computeSurprise(
  title: string,
  actualRaw: string,
  forecastRaw: string,
): Surprise | null {
  const rule = ruleFor(title);
  const forecast = parseFigure(forecastRaw);
  let actual = parseFigure(actualRaw);
  if (!rule || !forecast || !actual) return null;

  // "150" untuk data yang perkiraannya "115K" dibaca sebagai 150K.
  if (!actual.suffix && forecast.suffix && forecast.suffix !== "%") {
    actual = { value: actual.value * (SCALE[forecast.suffix] ?? 1), suffix: forecast.suffix };
  }

  const diff = actual.value - forecast.value;
  const ratio = Math.max(-2, Math.min(2, Math.round((diff / rule.threshold) * 1e6) / 1e6));
  const score = Math.round((ratio / 2) * 100 * rule.goldWhenHigher);
  const strength = Math.abs(ratio);

  let verdict: Surprise["verdict"] = "netral";
  if (strength >= 0.5) verdict = score > 0 ? "bullish" : "bearish";

  const size =
    strength < 0.5 ? "Sesuai perkiraan" : strength < 1 ? "Kejutan kecil" : strength < 2 ? "Kejutan besar" : "Kejutan sangat besar";
  const side = diff > 0 ? "di atas" : diff < 0 ? "di bawah" : "sama dengan";
  const text =
    verdict === "netral"
      ? `${size}. Angka ${side} perkiraan, biasanya reaksi pasar terbatas.`
      : `${size}: angka ${side} perkiraan, secara teori ${verdict === "bullish" ? "mendukung" : "menekan"} emas.`;

  return { diff, score, verdict, text };
}

export type Scenario = { higher: string; lower: string; why: string };

export function scenarioFor(event: CalendarEvent): Scenario | null {
  const rule = ruleFor(event.title);
  if (!rule) return null;
  const up = "Emas cenderung naik";
  const down = "Emas cenderung turun";
  return {
    higher: rule.goldWhenHigher > 0 ? up : down,
    lower: rule.goldWhenHigher > 0 ? down : up,
    why: rule.why,
  };
}
