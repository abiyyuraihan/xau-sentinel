"use client";

import { useNow } from "@/lib/hooks";
import type { Candle, MarketResponse, TickResponse } from "@/lib/types";
import { fmtClock, fmtPrice, signed, zoneClock } from "./ui";

const ZONES = [
  { name: "Jakarta", tz: "Asia/Jakarta" },
  { name: "London", tz: "Europe/London" },
  { name: "New York", tz: "America/New_York" },
];

function dayChange(candles: Candle[]) {
  if (candles.length < 2) return null;
  const lastBar = candles[candles.length - 1];
  const ref = [...candles].reverse().find((c) => c.time <= lastBar.time - 86400) ?? candles[0];
  const diff = lastBar.close - ref.close;
  return { diff, pct: (diff / ref.close) * 100, full: ref.time <= lastBar.time - 86400 };
}

export default function TopBar({
  market,
  candles,
  tick,
  live,
}: {
  market: MarketResponse | null;
  candles: Candle[];
  tick: TickResponse | null;
  live: boolean;
}) {
  const now = useNow(1000);
  const lastBar = candles[candles.length - 1];
  const change = dayChange(candles);
  const stale = now && lastBar ? now / 1000 - lastBar.time > 3 * 3600 : false;

  const sourceChip =
    market?.source === "twelvedata"
      ? { cls: "chip chip-up", text: "Candle XAU/USD spot, Twelve Data" }
      : market?.source === "yahoo"
        ? {
            cls: "chip chip-gold",
            text: market.basis !== 0 ? "Candle futures GC=F digeser ke spot (perkiraan)" : "Candle futures GC=F, Yahoo (bukan spot)",
          }
        : market?.source === "demo"
          ? { cls: "chip chip-down", text: "Data simulasi, bukan harga pasar" }
          : { cls: "chip", text: "Memuat harga" };
  const spread = tick?.bid && tick?.ask ? tick.ask - tick.bid : null;

  return (
    <header className="panel">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <svg width="38" height="38" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 3l11.3 6.5v13L16 29 4.7 22.5v-13z" fill="rgba(232,181,74,0.08)" stroke="var(--bullion)" strokeWidth="1.5" />
            <path d="M10 20l4-5 3 3 5-7" fill="none" stroke="var(--up)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <h1 className="font-display text-xl font-bold leading-none tracking-wide">XAU Sentinel</h1>
            <p className="mt-1 text-xs text-ice">Meja pantau emas untuk rilis data dan berita mendadak</p>
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div className="num price-glow text-4xl font-semibold leading-none text-bullion">
            {lastBar ? fmtPrice(lastBar.close) : "––––.––"}
          </div>
          {change ? (
            <div className={`num pb-0.5 text-sm ${change.diff >= 0 ? "text-up" : "text-down"}`}>
              {signed(change.diff)} ({signed(change.pct)}%)
              <span className="ml-2 font-sans text-xs text-ice">{change.full ? "24 jam" : "sejak awal grafik"}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${live ? "chip-up" : ""}`}>
            <span className={`dot ${live ? "dot-up live-dot" : ""}`} />
            {live ? `Harga langsung, ${tick?.source}` : "Harga langsung tidak aktif"}
          </span>
          {tick?.bid && tick?.ask && spread !== null ? (
            <span className="chip num">
              Bid <b className="font-medium text-down">{fmtPrice(tick.bid)}</b> Ask{" "}
              <b className="font-medium text-up">{fmtPrice(tick.ask)}</b> Spread <b className="font-medium text-paper">{spread.toFixed(2)}</b>
            </span>
          ) : null}
          <span className={sourceChip.cls}>{sourceChip.text}</span>
          {stale && lastBar ? (
            <span className="chip">Pasar tutup atau data tertunda, candle terakhir {fmtClock(lastBar.time * 1000)}</span>
          ) : null}
        </div>

        <div className="ml-auto flex flex-wrap gap-5">
          {ZONES.map((z) => (
            <div key={z.tz} className="text-right">
              <div className="text-xs text-ice">{z.name}</div>
              <div className="num text-base">{now ? zoneClock(now, z.tz) : "––:––"}</div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
