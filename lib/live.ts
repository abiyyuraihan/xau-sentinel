import { SIGNAL } from "./config";
import type { Candle, TickResponse } from "./types";

/**
 * Menyatukan kutipan harga terbaru ke deretan candle.
 * Candle terakhir diperbarui selama kutipan masih di dalam rentang waktunya;
 * setelah lewat, candle baru dibuka mengikuti kisi waktu sumber candle.
 */
export function withTick(
  candles: Candle[],
  tick: TickResponse | null,
  seconds: number,
  now: number,
): { candles: Candle[]; live: boolean } {
  const lastBar = candles[candles.length - 1];
  if (!tick || tick.price === null || !lastBar) return { candles, live: false };
  // Kutipan lama berarti pasar tutup atau sumber berhenti: grafik dibiarkan apa adanya.
  if (now - tick.time > SIGNAL.tickMaxAgeMinutes * 60_000) return { candles, live: false };

  const at = Math.floor(tick.time / 1000);
  const p = tick.price;
  if (at < lastBar.time) return { candles, live: false };

  if (at < lastBar.time + seconds) {
    const merged: Candle = {
      ...lastBar,
      close: p,
      high: Math.max(lastBar.high, p),
      low: Math.min(lastBar.low, p),
    };
    return { candles: [...candles.slice(0, -1), merged], live: true };
  }

  const time = lastBar.time + Math.floor((at - lastBar.time) / seconds) * seconds;
  const opened: Candle = {
    time,
    open: lastBar.close,
    close: p,
    high: Math.max(lastBar.close, p),
    low: Math.min(lastBar.close, p),
  };
  return { candles: [...candles, opened], live: true };
}
