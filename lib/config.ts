import type { Interval } from "./types";

// ───────── Harga ─────────

export const INTERVALS: { id: Interval; label: string; seconds: number; ttlMs: number }[] = [
  { id: "5min", label: "M5", seconds: 300, ttlMs: 120_000 },
  { id: "15min", label: "M15", seconds: 900, ttlMs: 180_000 },
  { id: "1h", label: "H1", seconds: 3600, ttlMs: 300_000 },
  { id: "4h", label: "H4", seconds: 14400, ttlMs: 600_000 },
  { id: "1day", label: "D1", seconds: 86400, ttlMs: 1_800_000 },
];

export const CANDLE_COUNT = 400;

// ───────── Berita ─────────
// "focused: true"  → semua judul ditampilkan (feed memang khusus emas/Fed).
// "focused: false" → feed umum; hanya judul yang cocok dengan kamus kata kunci yang lolos.
// Tambah, hapus, atau ganti feed di sini. Feed yang gagal tidak menghentikan feed lain.

export type FeedConfig = { name: string; url: string; focused: boolean };

const gnews = (q: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

export const FEEDS: FeedConfig[] = [
  { name: "Google News: emas", url: gnews("(gold price OR XAUUSD OR bullion) when:1d"), focused: true },
  { name: "Google News: The Fed", url: gnews("(Federal Reserve OR FOMC OR Powell) when:1d"), focused: true },
  {
    name: "Google News: geopolitik",
    url: gnews("(war OR missile OR airstrike OR sanctions OR ceasefire OR tariffs) when:1d"),
    focused: false,
  },
  { name: "Federal Reserve (resmi)", url: "https://www.federalreserve.gov/feeds/press_all.xml", focused: true },
  {
    name: "Google News: data ekonomi AS",
    url: gnews("(CPI OR inflation OR payrolls OR NFP OR PPI OR jobless claims) (US OR Fed) when:1d"),
    focused: false,
  },
  { name: "CNBC Economy", url: "https://www.cnbc.com/id/20910258/device/rss/rss.html", focused: false },
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", focused: false },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", focused: false },
];

export const NEWS_TTL_MS = 90_000;
export const NEWS_MAX_AGE_MS = 36 * 3600_000;
export const NEWS_MAX_ITEMS = 80;

// ───────── Kalender ─────────

export const CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
// Feed ini membatasi frekuensi akses dengan ketat. Jangan turunkan di bawah 30 menit.
export const CALENDAR_TTL_MS = 30 * 60_000;

// ───────── Mesin sinyal ─────────
// Semua ambang ada di sini supaya mudah diubah saat riset di akun demo.

export const SIGNAL = {
  /** Skor gabungan minimum (0–100) untuk memunculkan arah beli/jual */
  entryThreshold: 35,
  /** Jangan buka posisi baru sekian menit sebelum rilis berdampak tinggi */
  standbyMinutesBefore: 30,
  /** Hasil rilis yang dimasukkan dianggap masih relevan selama sekian menit */
  surpriseValidMinutes: 240,
  /** Kelipatan ATR untuk stop loss dan target */
  slAtr: 1.5,
  tp1Atr: 1.5,
  tp2Atr: 3,
  /** Berita: waktu paruh pengaruh sebuah judul, dalam menit */
  newsHalfLifeMinutes: 45,
  /** Berita: jendela kandidat breaking, dalam menit */
  breakingWindowMinutes: 90,
  /** Tekanan berita minimum untuk status pantau dan siaga */
  pressureWatch: 3,
  pressureAlert: 6,
  /** Tekanan berita yang cukup bila harga ikut bergerak tak wajar */
  pressureAlertWithShock: 4,
  /** Pergerakan 3 candle terakhir dibanding ATR yang dianggap tak wajar */
  shockAtrMultiple: 2,
  /** Jurnal otomatis: jeda minimum antar catatan searah, dalam menit */
  autoLogCooldownMinutes: 15,
  /** Kutipan harga langsung yang lebih tua dari ini dianggap pasar tutup, dalam menit */
  tickMaxAgeMinutes: 10,
};
