import type { TechnicalSummary } from "@/lib/technical";
import { Panel, fmtPrice, signed } from "./ui";

export default function TechnicalPanel({ summary, intervalLabel }: { summary: TechnicalSummary | null; intervalLabel: string }) {
  const score = summary?.score ?? 0;
  const label = score >= 35 ? "Condong naik" : score <= -35 ? "Condong turun" : "Campuran";

  return (
    <Panel title="Analisis teknikal" meta={<span className="chip">{intervalLabel}</span>}>
      {!summary?.ready ? (
        <p className="text-[13px] text-ice">Butuh minimal 60 candle untuk menghitung indikator.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-baseline justify-between">
              <span className={`font-display text-lg font-semibold ${score >= 35 ? "text-up" : score <= -35 ? "text-down" : "text-bullion"}`}>
                {label}
              </span>
              <span className="num text-2xl">{signed(score, 0)}</span>
            </div>
            <div className="relative mt-2 h-2 bg-rib">
              <span className="absolute left-1/2 top-[-3px] h-[14px] w-px bg-ice" />
              <span
                className="absolute top-0 h-full"
                style={{
                  background: score >= 0 ? "var(--up)" : "var(--down)",
                  width: `${Math.abs(score) / 2}%`,
                  left: score >= 0 ? "50%" : `${50 - Math.abs(score) / 2}%`,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-ice">
              <span>−100 turun</span>
              <span>+100 naik</span>
            </div>
          </div>

          <ul className="grid gap-2.5">
            {summary.readings.map((r) => (
              <li key={r.name} className="flex items-start gap-3">
                <span className={`dot mt-1.5 ${r.verdict > 0 ? "dot-up" : r.verdict < 0 ? "dot-down" : ""}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-3">
                    <span className="text-[13px]">{r.name}</span>
                    <span className="num text-[13px] text-ice">{r.value}</span>
                  </div>
                  <div className="text-xs text-ice">{r.text}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-3 gap-px bg-rib text-center">
            <div className="bg-hull px-1 py-2">
              <div className="text-xs text-ice">Batas bawah</div>
              <div className="num text-sm text-up">{summary.support ? fmtPrice(summary.support) : "–"}</div>
            </div>
            <div className="bg-hull px-1 py-2">
              <div className="text-xs text-ice">ATR 14</div>
              <div className="num text-sm">{summary.atr ? summary.atr.toFixed(2) : "–"}</div>
            </div>
            <div className="bg-hull px-1 py-2">
              <div className="text-xs text-ice">Batas atas</div>
              <div className="num text-sm text-down">{summary.resistance ? fmtPrice(summary.resistance) : "–"}</div>
            </div>
          </div>
          <p className="text-xs text-ice">
            Batas atas dan bawah adalah harga tertinggi dan terendah 60 candle terakhir. ATR mengukur rata-rata rentang gerak per candle.
          </p>
        </div>
      )}
    </Panel>
  );
}
