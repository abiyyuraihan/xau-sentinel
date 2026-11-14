import { cached, fetchJson } from "../cache";
import { CALENDAR_TTL_MS, CALENDAR_URL } from "../config";
import type {
  CalendarEvent,
  CalendarResponse,
  Impact,
  OfficialKey,
  OfficialPrint,
  SourceAttempt,
} from "../types";

// ───────── Jadwal + perkiraan: ekspor mingguan Forex Factory ─────────

type FFEvent = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
};

const IMPACTS: Impact[] = ["High", "Medium", "Low", "Holiday"];

async function loadSchedule(): Promise<CalendarEvent[]> {
  const raw = await fetchJson<FFEvent[]>(CALENDAR_URL, {
    headers: { "User-Agent": "xau-sentinel (personal research dashboard)" },
  });
  if (!Array.isArray(raw)) throw new Error("Format kalender tidak dikenali");
  const events: CalendarEvent[] = [];
  for (const e of raw) {
    const time = e.date ? Date.parse(e.date) : NaN;
    if (!e.title || !Number.isFinite(time)) continue;
    const impact = IMPACTS.find((i) => i === e.impact) ?? "Low";
    events.push({
      id: `${e.country ?? ""}|${e.title}|${time}`,
      title: e.title,
      country: e.country ?? "",
      time,
      impact,
      forecast: e.forecast ?? "",
      previous: e.previous ?? "",
    });
  }
  return events.sort((a, b) => a.time - b.time);
}

// ───────── Angka resmi: API publik BLS ─────────

type BlsPoint = { year: string; period: string; value: string };
type BlsResponse = {
  status?: string;
  message?: string[];
  Results?: { series?: { seriesID: string; data: BlsPoint[] }[] };
};

const SERIES = {
  cpiSa: "CUSR0000SA0",
  cpiNsa: "CUUR0000SA0",
  coreSa: "CUSR0000SA0L1E",
  coreNsa: "CUUR0000SA0L1E",
  payrolls: "CES0000000001",
  unemp: "LNS14000000",
  ppi: "WPSFD4",
  ahe: "CES0500000003",
};

type Point = { ym: number; year: number; month: number; value: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const periodLabel = (p: Point) => `${MONTHS[p.month - 1]} ${p.year}`;

function toPoints(data: BlsPoint[] | undefined): Point[] {
  if (!data) return [];
  const out: Point[] = [];
  for (const d of data) {
    const m = /^M(0[1-9]|1[0-2])$/.exec(d.period);
    const value = Number(d.value);
    if (!m || !Number.isFinite(value)) continue;
    const year = Number(d.year);
    const month = Number(m[1]);
    out.push({ ym: year * 12 + month, year, month, value });
  }
  return out.sort((a, b) => b.ym - a.ym);
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** Perubahan dari bulan sebelumnya. Hanya dihitung bila dua bulan itu berurutan. */
function monthly(points: Point[], offset: number, mode: "pct" | "diff" | "level"): number | null {
  const cur = points[offset];
  if (!cur) return null;
  if (mode === "level") return cur.value;
  const prev = points.find((p) => p.ym === cur.ym - 1);
  if (!prev) return null;
  return mode === "pct" ? round((cur.value / prev.value - 1) * 100, 1) : round(cur.value - prev.value, 0);
}

function yearly(points: Point[], offset: number): number | null {
  const cur = points[offset];
  if (!cur) return null;
  const prev = points.find((p) => p.ym === cur.ym - 12);
  return prev ? round((cur.value / prev.value - 1) * 100, 1) : null;
}

async function loadOfficial(): Promise<OfficialPrint[]> {
  const year = new Date().getUTCFullYear();
  const key = process.env.BLS_API_KEY?.trim();
  const body: Record<string, unknown> = {
    seriesid: Object.values(SERIES),
    startyear: String(year - 2),
    endyear: String(year),
  };
  if (key) body.registrationkey = key;

  const data = await fetchJson<BlsResponse>(
    "https://api.bls.gov/publicAPI/v2/timeseries/data/",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    12_000,
  );
  if (data.status !== "REQUEST_SUCCEEDED" || !data.Results?.series) {
    throw new Error(data.message?.[0] ?? "BLS menolak permintaan");
  }

  const by = new Map<string, Point[]>();
  for (const s of data.Results.series) by.set(s.seriesID, toPoints(s.data));

  const out: OfficialPrint[] = [];
  const add = (
    k: OfficialKey,
    label: string,
    unit: "%" | "K",
    points: Point[] | undefined,
    calc: (p: Point[], offset: number) => number | null,
  ) => {
    if (!points?.length) return;
    const value = calc(points, 0);
    if (value === null) return;
    const previous = calc(points, 1);
    out.push({
      key: k,
      label,
      unit,
      value,
      period: periodLabel(points[0]),
      previous,
      previousPeriod: previous !== null && points[1] ? periodLabel(points[1]) : null,
    });
  };

  add("cpi_mm", "CPI m/m", "%", by.get(SERIES.cpiSa), (p, o) => monthly(p, o, "pct"));
  add("cpi_yy", "CPI y/y", "%", by.get(SERIES.cpiNsa), yearly);
  add("core_cpi_mm", "Core CPI m/m", "%", by.get(SERIES.coreSa), (p, o) => monthly(p, o, "pct"));
  add("core_cpi_yy", "Core CPI y/y", "%", by.get(SERIES.coreNsa), yearly);
  add("nfp", "Non-Farm Payrolls", "K", by.get(SERIES.payrolls), (p, o) => monthly(p, o, "diff"));
  add("unemp", "Tingkat pengangguran", "%", by.get(SERIES.unemp), (p, o) => monthly(p, o, "level"));
  add("ppi_mm", "PPI m/m", "%", by.get(SERIES.ppi), (p, o) => monthly(p, o, "pct"));
  add("ahe_mm", "Upah per jam m/m", "%", by.get(SERIES.ahe), (p, o) => monthly(p, o, "pct"));
  return out;
}

// ───────── Gabungan ─────────

export async function getCalendar(): Promise<CalendarResponse> {
  const attempts: SourceAttempt[] = [];
  let events: CalendarEvent[] = [];
  let official: OfficialPrint[] = [];

  const hasKey = Boolean(process.env.BLS_API_KEY?.trim());
  const [sched, off] = await Promise.allSettled([
    cached("calendar:schedule", CALENDAR_TTL_MS, loadSchedule),
    // Tanpa kunci, BLS hanya mengizinkan 25 permintaan per hari.
    cached("calendar:official", hasKey ? 5 * 60_000 : 60 * 60_000, loadOfficial),
  ]);

  if (sched.status === "fulfilled") {
    events = sched.value.value;
    attempts.push({
      name: "Kalender ekonomi",
      ok: !sched.value.stale,
      detail: sched.value.stale
        ? `Memakai data lama: ${sched.value.error}`
        : `${events.length} agenda minggu ini`,
    });
  } else {
    attempts.push({ name: "Kalender ekonomi", ok: false, detail: String(sched.reason?.message ?? sched.reason) });
  }

  if (off.status === "fulfilled") {
    official = off.value.value;
    attempts.push({
      name: "BLS (angka resmi)",
      ok: !off.value.stale,
      detail: off.value.stale
        ? `Memakai data lama: ${off.value.error}`
        : `${official.length} indikator${hasKey ? "" : ", tanpa kunci (25 permintaan/hari)"}`,
    });
  } else {
    attempts.push({ name: "BLS (angka resmi)", ok: false, detail: String(off.reason?.message ?? off.reason) });
  }

  return { events, official, attempts, fetchedAt: Date.now() };
}
