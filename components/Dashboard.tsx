"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INTERVALS, SIGNAL } from "@/lib/config";
import { useNow, usePolling, useStored } from "@/lib/hooks";
import { canAutoLog, evaluate, type JournalEntry } from "@/lib/journal";
import { withTick } from "@/lib/live";
import {
  breakingState,
  composeSignal,
  newsPressure,
  priceShock,
  type SurpriseEntry,
} from "@/lib/signal";
import { analyzeTechnical } from "@/lib/technical";
import type { CalendarResponse, Interval, MarketResponse, NewsResponse, TickResponse } from "@/lib/types";
import EventHorizon from "./EventHorizon";
import FundamentalPanel from "./FundamentalPanel";
import JournalPanel from "./JournalPanel";
import NewsPanel from "./NewsPanel";
import PriceChart, { type ChartLevels } from "./PriceChart";
import SignalCore from "./SignalCore";
import StatusPanel from "./StatusPanel";
import TechnicalPanel from "./TechnicalPanel";
import TopBar from "./TopBar";
import { Panel } from "./ui";

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close();
  } catch {
    // Browser menolak memutar suara tanpa interaksi: cukup notifikasi visual.
  }
}

function notify(title: string, body: string) {
  beep();
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body, tag: "xau-sentinel" });
  }
}

export default function Dashboard() {
  const [interval, setIntervalId] = useState<Interval>("15min");
  const [showEma, setShowEma] = useState(true);
  const [showBands, setShowBands] = useState(false);

  const market = usePolling<MarketResponse>(`/api/market?interval=${interval}`, 30_000);
  const calendar = usePolling<CalendarResponse>("/api/calendar", 5 * 60_000);
  const news = usePolling<NewsResponse>("/api/news", 60_000);
  const tick = usePolling<TickResponse>("/api/tick", 2_500);
  const now = useNow(15_000);

  const [surprise, setSurprise] = useStored<SurpriseEntry | null>("xau-sentinel:surprise", null);
  const [journal, setJournal] = useStored<JournalEntry[]>("xau-sentinel:journal", []);
  const [notifyOn, setNotifyOn] = useStored<boolean>("xau-sentinel:notify", false);
  const [autoLog, setAutoLog] = useStored<boolean>("xau-sentinel:autolog", true);

  // Saat timeframe diganti, grafik lama tetap tampil sampai data baru datang.
  const shownMarket = market.data ?? market.last;

  // Candle dari server disatukan dengan kutipan harga terbaru, sehingga candle terakhir
  // bergerak setiap beberapa detik. Data simulasi tidak disentuh.
  const seconds = INTERVALS.find((i) => i.id === interval)!.seconds;
  const merged = useMemo(() => {
    const base = market.data?.candles ?? [];
    if (!now || !market.data || market.data.source === "demo") return { candles: base, live: false };
    return withTick(base, tick.data, seconds, now);
  }, [market.data, tick.data, seconds, now]);
  const candles = merged.candles;
  const events = useMemo(() => calendar.data?.events ?? [], [calendar.data]);
  const items = useMemo(() => news.data?.items ?? [], [news.data]);
  const simulated = shownMarket?.source === "demo";
  const intervalLabel = INTERVALS.find((i) => i.id === interval)!.label;

  const technical = useMemo(() => (candles.length ? analyzeTechnical(candles) : null), [candles]);
  const shock = useMemo(() => (candles.length ? priceShock(candles) : null), [candles]);
  const pressure = useMemo(() => (now && news.data ? newsPressure(items, now) : null), [items, news.data, now]);
  const breaking = useMemo(
    () => (pressure && shock ? breakingState(pressure, shock) : null),
    [pressure, shock],
  );
  const signal = useMemo(() => {
    if (!now || !technical?.ready || !pressure || !breaking) return null;
    return composeSignal({ technical, news: pressure, breaking, surprise, events, now });
  }, [now, technical, pressure, breaking, surprise, events]);

  const levels: ChartLevels =
    signal && signal.stop && signal.tp1 && signal.tp2
      ? { entry: signal.entry, stop: signal.stop, tp1: signal.tp1, tp2: signal.tp2 }
      : null;

  // Notifikasi hanya saat status berubah, bukan di setiap pembaruan data.
  const prev = useRef<{ level: string; action: string } | null>(null);
  useEffect(() => {
    if (!signal || !breaking) return;
    const cur = { level: breaking.level, action: signal.action };
    const before = prev.current;
    prev.current = cur;
    if (!before || !notifyOn) return;
    if (cur.level === "siaga" && before.level !== "siaga") {
      notify("XAU Sentinel: berita mendadak", breaking.reason);
    } else if (cur.action !== before.action && cur.action !== "TUNGGU") {
      notify(`XAU Sentinel: ${signal.headline}`, signal.detail);
    }
  }, [signal, breaking, notifyOn]);

  // Hasil jurnal dicek ulang setiap candle baru datang. Hanya terhadap sumber harga yang sama.
  useEffect(() => {
    if (!market.data || candles.length === 0) return;
    const source = market.data.source;
    setJournal((list) => {
      let changed = false;
      const next = list.map((e) => {
        if (e.result || e.source !== source) return e;
        const result = evaluate(e, candles);
        if (!result) return e;
        changed = true;
        return { ...e, result, resolvedAt: Date.now() };
      });
      return changed ? next : list;
    });
  }, [candles, market.data, setJournal]);

  const logSignal = useCallback((auto = false) => {
    if (!signal || signal.action === "TUNGGU" || !signal.stop || !signal.tp1 || !signal.tp2 || !market.data) return;
    const entry: JournalEntry = {
      auto,
      id: `${Date.now()}`,
      at: Date.now(),
      mode: signal.mode,
      action: signal.action,
      entry: signal.entry,
      stop: signal.stop,
      tp1: signal.tp1,
      tp2: signal.tp2,
      score: signal.score,
      interval,
      source: market.data.source,
      result: null,
    };
    setJournal((list) => [entry, ...list].slice(0, 200));
  }, [signal, market.data, interval, setJournal]);

  // Jurnal otomatis: mencatat begitu sinyal menunjukkan arah, selama belum ada catatan
  // searah yang masih terbuka. Tidak berjalan pada data simulasi.
  useEffect(() => {
    if (!autoLog || !signal || signal.action === "TUNGGU" || simulated) return;
    if (!canAutoLog(journal, signal.action, Date.now(), SIGNAL.autoLogCooldownMinutes * 60_000)) return;
    logSignal(true);
  }, [autoLog, signal, simulated, journal, logSignal]);

  const toggleNotify = useCallback(async () => {
    if (notifyOn) {
      setNotifyOn(false);
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    setNotifyOn(true);
    beep();
  }, [notifyOn, setNotifyOn]);

  const refreshAll = () => {
    market.refresh();
    calendar.refresh();
    news.refresh();
    tick.refresh();
  };

  const errors = [
    market.error ? `Harga: ${market.error}` : null,
    calendar.error ? `Kalender: ${calendar.error}` : null,
    news.error ? `Berita: ${news.error}` : null,
  ].filter((e): e is string => Boolean(e));

  return (
    <main className="mx-auto grid max-w-[1720px] gap-4 p-3 sm:p-5">
      <TopBar market={shownMarket} candles={market.data ? candles : (shownMarket?.candles ?? [])} tick={tick.data} live={merged.live} />
      <EventHorizon events={events} loaded={Boolean(calendar.data)} />

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel
          className="xl:col-span-8"
          title="Grafik harga"
          bodyClassName="!p-2"
          meta={
            <>
              <span className="flex items-center gap-2 text-xs">
                <span className={`dot ${merged.live ? "dot-up live-dot" : ""}`} />
                {merged.live ? "Langsung" : "Tidak langsung"}, {shownMarket?.label ?? "memuat"}, waktu lokal browser
              </span>
              <div className="seg" role="group" aria-label="Lapisan indikator">
                <button aria-pressed={showEma} onClick={() => setShowEma((v) => !v)}>
                  EMA
                </button>
                <button aria-pressed={showBands} onClick={() => setShowBands((v) => !v)}>
                  Bollinger
                </button>
              </div>
              <div className="seg" role="group" aria-label="Timeframe">
                {INTERVALS.map((i) => (
                  <button key={i.id} aria-pressed={interval === i.id} onClick={() => setIntervalId(i.id)}>
                    {i.label}
                  </button>
                ))}
              </div>
            </>
          }
        >
          <PriceChart
            candles={market.data ? candles : (shownMarket?.candles ?? [])}
            interval={shownMarket?.interval ?? interval}
            showEma={showEma}
            showBands={showBands}
            events={events}
            levels={market.data ? levels : null}
            simulated={simulated}
          />
        </Panel>

        <Panel className="xl:col-span-4" title="Sinyal gabungan" meta={<span className="chip">{intervalLabel}</span>}>
          <SignalCore
            signal={signal}
            simulated={simulated}
            onLog={() => logSignal(false)}
            notifyOn={notifyOn}
            onToggleNotify={toggleNotify}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <div className="grid xl:col-span-3">
          <TechnicalPanel summary={technical} intervalLabel={intervalLabel} />
        </div>
        <div className="grid xl:col-span-5">
          <FundamentalPanel
            events={events}
            official={calendar.data?.official ?? []}
            loaded={Boolean(calendar.data)}
            now={now}
            surprise={surprise}
            onSurprise={setSurprise}
          />
        </div>
        <div className="grid lg:col-span-2 xl:col-span-4">
          <NewsPanel
            items={items}
            loaded={Boolean(news.data)}
            now={now}
            breaking={breaking}
            pressure={pressure}
            shock={shock}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="grid xl:col-span-8">
          <JournalPanel
            entries={journal}
            price={candles.length ? candles[candles.length - 1].close : null}
            onRemove={(id) => setJournal((list) => list.filter((e) => e.id !== id))}
            onClear={() => setJournal([])}
            autoLog={autoLog}
            onToggleAuto={() => setAutoLog((v) => !v)}
          />
        </div>
        <div className="grid xl:col-span-4">
          <StatusPanel
            onRefresh={refreshAll}
            errors={errors}
            groups={[
              { name: "Candle", attempts: shownMarket?.attempts ?? [] },
              { name: "Harga langsung", attempts: tick.data?.attempts ?? [] },
              { name: "Kalender dan angka resmi", attempts: calendar.data?.attempts ?? [] },
              { name: "Feed berita", attempts: news.data?.attempts ?? [] },
            ]}
          />
        </div>
      </div>

      <footer className="px-1 pb-4 text-xs leading-relaxed text-ice">
        Alat riset pribadi untuk diuji di akun demo. Sinyal dihitung dengan aturan sederhana dan bisa salah; ini bukan nasihat keuangan.
        Trading saat rilis data berisiko tinggi karena spread melebar dan slippage. Peringatan hanya bekerja selama halaman ini terbuka.
      </footer>
    </main>
  );
}
