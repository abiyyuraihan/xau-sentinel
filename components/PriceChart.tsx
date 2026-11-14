"use client";

import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { INTERVALS } from "@/lib/config";
import { bollinger, ema, rsi, type Series } from "@/lib/indicators";
import type { CalendarEvent, Candle, Interval } from "@/lib/types";
import { fmtPrice } from "./ui";

export type ChartLevels = { entry: number; stop: number; tp1: number; tp2: number } | null;

type Props = {
  candles: Candle[];
  interval: Interval;
  showEma: boolean;
  showBands: boolean;
  events: CalendarEvent[];
  levels: ChartLevels;
  simulated: boolean;
};

const COLORS = {
  up: "#2FD3A7",
  down: "#FF5C7A",
  gold: "#E8B54A",
  plasma: "#6C8CFF",
  paper: "#D7DEEE",
  ice: "#8FA3C8",
  rib: "#141A28",
};

type Refs = {
  chart: IChartApi;
  candle: ISeriesApi<"Candlestick">;
  ema20: ISeriesApi<"Line">;
  ema50: ISeriesApi<"Line">;
  ema200: ISeriesApi<"Line">;
  bbUpper: ISeriesApi<"Line">;
  bbLower: ISeriesApi<"Line">;
  rsi: ISeriesApi<"Line">;
  markers: ISeriesMarkersPluginApi<Time>;
  lines: IPriceLine[];
};

export default function PriceChart({ candles, interval, showEma, showBands, events, levels, simulated }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const refs = useRef<Refs | null>(null);
  const shownInterval = useRef<Interval | null>(null);
  const [hover, setHover] = useState<Candle | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const chart = createChart(host.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: COLORS.ice,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(143,163,200,0.06)" },
        horzLines: { color: "rgba(143,163,200,0.06)" },
      },
      rightPriceScale: { borderColor: COLORS.rib },
      timeScale: { borderColor: COLORS.rib, timeVisible: true, secondsVisible: false, rightOffset: 6 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(232,181,74,0.5)", labelBackgroundColor: "#141A28" },
        horzLine: { color: "rgba(232,181,74,0.5)", labelBackgroundColor: "#141A28" },
      },
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      borderUpColor: COLORS.up,
      borderDownColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    const line = (color: string, width: 1 | 2, style = LineStyle.Solid) =>
      chart.addSeries(LineSeries, {
        color,
        lineWidth: width,
        lineStyle: style,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

    // Panel kedua di bawah grafik harga untuk RSI 14, dengan garis batas 70 dan 30.
    const rsiSeries = chart.addSeries(
      LineSeries,
      {
        color: COLORS.plasma,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: false,
        priceFormat: { type: "price", precision: 1, minMove: 0.1 },
        autoscaleInfoProvider: () => ({ priceRange: { minValue: 10, maxValue: 90 } }),
      },
      1,
    );
    for (const [price, color] of [
      [70, "rgba(255,92,122,0.5)"],
      [30, "rgba(47,211,167,0.5)"],
    ] as const) {
      rsiSeries.createPriceLine({ price, color, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "" });
    }
    chart.panes()[1]?.setHeight(96);

    refs.current = {
      chart,
      rsi: rsiSeries,
      candle,
      ema20: line(COLORS.gold, 2),
      ema50: line(COLORS.plasma, 2),
      ema200: line(COLORS.paper, 1),
      bbUpper: line("rgba(143,163,200,0.55)", 1, LineStyle.Dotted),
      bbLower: line("rgba(143,163,200,0.55)", 1, LineStyle.Dotted),
      markers: createSeriesMarkers(candle, []),
      lines: [],
    };

    chart.subscribeCrosshairMove((param) => {
      const bar = param.time ? (param.seriesData.get(candle) as Candle | undefined) : undefined;
      setHover(bar && "open" in bar ? { ...bar, time: Number(param.time) } : null);
    });

    return () => {
      chart.remove();
      refs.current = null;
      shownInterval.current = null;
    };
  }, []);

  useEffect(() => {
    const r = refs.current;
    if (!r || candles.length === 0) return;

    // Sumbu waktu grafik digeser ke zona waktu browser.
    const shift = -new Date().getTimezoneOffset() * 60;
    const t = (c: Candle) => (c.time + shift) as UTCTimestamp;
    const closes = candles.map((c) => c.close);
    const toLine = (s: Series) =>
      s.flatMap((v, i) => (v === null ? [] : [{ time: t(candles[i]), value: v }]));

    r.candle.setData(candles.map((c) => ({ time: t(c), open: c.open, high: c.high, low: c.low, close: c.close })));
    r.ema20.setData(showEma ? toLine(ema(closes, 20)) : []);
    r.ema50.setData(showEma ? toLine(ema(closes, 50)) : []);
    r.ema200.setData(showEma ? toLine(ema(closes, 200)) : []);
    const bb = bollinger(closes, 20, 2);
    r.bbUpper.setData(showBands ? toLine(bb.upper) : []);
    r.bbLower.setData(showBands ? toLine(bb.lower) : []);
    r.rsi.setData(toLine(rsi(closes, 14)));

    // Penanda rilis berdampak tinggi yang sudah lewat dan masih ada di rentang grafik.
    const seconds = INTERVALS.find((i) => i.id === interval)!.seconds;
    const marks: SeriesMarker<Time>[] = [];
    for (const e of events) {
      if (e.country !== "USD" || e.impact !== "High") continue;
      const at = Math.floor(e.time / 1000);
      const bar = candles.find((c) => at >= c.time && at < c.time + seconds);
      if (!bar) continue;
      const time = t(bar);
      if (marks.some((m) => m.time === time)) continue;
      marks.push({ time, position: "aboveBar", color: COLORS.gold, shape: "circle", text: e.title });
    }
    r.markers.setMarkers(marks);

    for (const l of r.lines) r.candle.removePriceLine(l);
    r.lines = [];
    if (levels) {
      const add = (price: number, color: string, title: string) =>
        r.lines.push(
          r.candle.createPriceLine({ price, color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title }),
        );
      add(levels.stop, COLORS.down, "SL");
      add(levels.tp1, COLORS.up, "TP1");
      add(levels.tp2, COLORS.up, "TP2");
    }

    if (shownInterval.current !== interval) {
      shownInterval.current = interval;
      const n = candles.length;
      r.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 130), to: n + 6 });
    }
  }, [candles, interval, showEma, showBands, events, levels]);

  const shown = hover ?? candles[candles.length - 1] ?? null;

  return (
    <div className="relative h-[540px] w-full">
      {shown ? (
        <div className="num pointer-events-none absolute left-3 top-2 z-[4] flex flex-wrap gap-x-4 gap-y-1 text-xs text-ice">
          <span>
            O <b className="font-medium text-paper">{fmtPrice(shown.open)}</b>
          </span>
          <span>
            H <b className="font-medium text-paper">{fmtPrice(shown.high)}</b>
          </span>
          <span>
            L <b className="font-medium text-paper">{fmtPrice(shown.low)}</b>
          </span>
          <span>
            C{" "}
            <b className={`font-medium ${shown.close >= shown.open ? "text-up" : "text-down"}`}>
              {fmtPrice(shown.close)}
            </b>
          </span>
          {showEma ? (
            <span className="hidden sm:inline">
              <i className="not-italic text-bullion">EMA 20</i> <i className="not-italic text-plasma">EMA 50</i>{" "}
              <i className="not-italic text-paper">EMA 200</i>
            </span>
          ) : null}
          <span className="hidden sm:inline">Panel bawah: RSI 14</span>
        </div>
      ) : null}
      {simulated ? <div className="watermark">DATA SIMULASI</div> : null}
      <div ref={host} className="absolute inset-0" />
    </div>
  );
}
