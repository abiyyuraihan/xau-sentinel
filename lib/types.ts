export type Candle = {
  /** Unix detik (UTC), awal candle */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type Interval = "5min" | "15min" | "1h" | "4h" | "1day";

export type SourceAttempt = { name: string; ok: boolean; detail: string };

export type MarketSource = "twelvedata" | "yahoo" | "demo";

export type MarketResponse = {
  interval: Interval;
  candles: Candle[];
  source: MarketSource;
  /** Nama instrumen yang benar-benar dipakai, untuk ditampilkan apa adanya */
  label: string;
  /** Selisih yang ditambahkan ke candle futures supaya sejajar dengan harga spot. 0 bila tidak digeser. */
  basis: number;
  attempts: SourceAttempt[];
  fetchedAt: number;
};

export type TickResponse = {
  /** Harga tengah spot XAU/USD. null bila semua sumber gagal. */
  price: number | null;
  bid: number | null;
  ask: number | null;
  /** Unix milidetik kutipan */
  time: number;
  source: string | null;
  attempts: SourceAttempt[];
};

export type Impact = "High" | "Medium" | "Low" | "Holiday";

export type CalendarEvent = {
  id: string;
  title: string;
  country: string;
  /** Unix milidetik */
  time: number;
  impact: Impact;
  forecast: string;
  previous: string;
};

export type OfficialKey =
  | "cpi_mm"
  | "cpi_yy"
  | "core_cpi_mm"
  | "core_cpi_yy"
  | "nfp"
  | "unemp"
  | "ppi_mm"
  | "ahe_mm";

export type OfficialPrint = {
  key: OfficialKey;
  label: string;
  value: number;
  unit: "%" | "K";
  period: string;
  previous: number | null;
  previousPeriod: string | null;
};

export type CalendarResponse = {
  events: CalendarEvent[];
  official: OfficialPrint[];
  attempts: SourceAttempt[];
  fetchedAt: number;
};

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  feed: string;
  /** Unix milidetik */
  publishedAt: number;
  /** Negatif = menekan emas, positif = mendukung emas */
  score: number;
  tags: string[];
  urgent: boolean;
};

export type NewsResponse = {
  items: NewsItem[];
  attempts: SourceAttempt[];
  fetchedAt: number;
};
