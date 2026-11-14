"use client";

import type { Composite } from "@/lib/signal";
import { fmtPrice, signed } from "./ui";

const C = 150;

// Koordinat dibulatkan supaya hasil di server dan di browser persis sama
// (fungsi trigonometri bisa berbeda di digit terakhir antar mesin JavaScript).
const r2 = (n: number) => Math.round(n * 100) / 100;

function Ring({ r, score, dim }: { r: number; score: number | null; dim?: boolean }) {
  const circumference = r2(2 * Math.PI * r);
  const half = circumference / 2;
  const len = score === null ? 0 : r2((Math.min(100, Math.abs(score)) / 100) * half);
  const color = (score ?? 0) >= 0 ? "var(--up)" : "var(--down)";
  return (
    <g>
      <circle cx={C} cy={C} r={r} fill="none" stroke="var(--rib)" strokeWidth={9} opacity={dim ? 0.45 : 1} />
      {/* Busur berawal dari jam 12. Ke kanan = mendukung beli, ke kiri = mendukung jual. */}
      <circle
        className="core-ring"
        cx={C}
        cy={C}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={9}
        strokeLinecap="butt"
        strokeDasharray={`${len} ${circumference}`}
        transform={`rotate(-90 ${C} ${C})${(score ?? 0) < 0 ? ` translate(0 ${2 * C}) scale(1 -1)` : ""}`}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </g>
  );
}

const MODE_LABEL: Record<Composite["mode"], string> = {
  teknikal: "Mode teknikal",
  rilis: "Mode rilis data",
  breaking: "Mode berita mendadak",
  "siaga-rilis": "Menunggu rilis",
};

export default function SignalCore({
  signal,
  simulated,
  onLog,
  notifyOn,
  onToggleNotify,
}: {
  signal: Composite | null;
  simulated: boolean;
  onLog: () => void;
  notifyOn: boolean;
  onToggleNotify: () => void;
}) {
  const action = signal?.action ?? "TUNGGU";
  const actionColor = action === "BELI" ? "var(--up)" : action === "JUAL" ? "var(--down)" : "var(--bullion)";
  const ticks = Array.from({ length: 72 }, (_, i) => i);

  const rows: { name: string; score: number | null; weight: number }[] = signal
    ? [
        { name: "Teknikal", score: signal.parts.technical, weight: signal.weights.technical },
        { name: "Rilis data", score: signal.parts.event, weight: signal.weights.event },
        { name: "Arus berita", score: signal.parts.news, weight: signal.weights.news },
      ]
    : [];

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="relative mx-auto w-full max-w-[300px]">
        <svg viewBox="0 0 300 300" role="img" aria-label={`Sinyal gabungan: ${action}, skor ${signal?.score ?? 0}`}>
          <g className="core-orbit">
            <circle cx={C} cy={C} r={144} fill="none" stroke="var(--rib-2)" strokeWidth={1} strokeDasharray="2 10" />
          </g>
          {ticks.map((i) => {
            const a = (i / 72) * 2 * Math.PI;
            const major = i % 6 === 0;
            const r1 = major ? 130 : 133;
            return (
              <line
                key={i}
                x1={r2(C + r1 * Math.sin(a))}
                y1={r2(C - r1 * Math.cos(a))}
                x2={r2(C + 138 * Math.sin(a))}
                y2={r2(C - 138 * Math.cos(a))}
                stroke={major ? "var(--ice)" : "var(--rib-2)"}
                strokeWidth={1}
              />
            );
          })}
          <Ring r={118} score={signal?.parts.technical ?? null} />
          <Ring r={103} score={signal?.parts.event ?? null} dim={signal?.parts.event === null} />
          <Ring r={88} score={signal?.parts.news ?? null} />
          <line x1={C} y1={22} x2={C} y2={70} stroke="var(--bullion)" strokeWidth={1.5} />
          <text x={36} y={C + 4} fill="var(--down)" fontSize="11" fontFamily="var(--font-display)" textAnchor="middle">
            jual
          </text>
          <text x={264} y={C + 4} fill="var(--up)" fontSize="11" fontFamily="var(--font-display)" textAnchor="middle">
            beli
          </text>
          <text
            x={C}
            y={C - 6}
            textAnchor="middle"
            fill={actionColor}
            fontFamily="var(--font-display)"
            fontWeight={700}
            fontSize="36"
            letterSpacing="2"
          >
            {action}
          </text>
          <text x={C} y={C + 22} textAnchor="middle" fill="var(--paper)" fontFamily="var(--font-display)" fontSize="18">
            {signal ? signed(signal.score, 0) : "…"}
          </text>
          <text x={C} y={C + 42} textAnchor="middle" fill="var(--ice)" fontSize="11">
            {signal ? MODE_LABEL[signal.mode] : "Memuat data"}
          </text>
        </svg>
      </div>

      {signal ? (
        <>
          <div>
            <p className="font-display text-lg font-semibold" style={{ color: actionColor }}>
              {signal.headline}
            </p>
            <p className="mt-1 text-[13px] text-ice">{signal.detail}</p>
            {simulated ? (
              <p className="mt-2 text-[13px] text-bullion">
                Harga yang dipakai adalah data simulasi. Sinyal ini tidak mencerminkan pasar.
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            {rows.map((row) => (
              <div key={row.name} className="flex items-center gap-3 text-[13px]">
                <span className="w-24 text-ice">{row.name}</span>
                <div className="relative h-1.5 flex-1 bg-rib">
                  <span className="absolute left-1/2 top-[-3px] h-3 w-px bg-rib-2" />
                  {row.score !== null ? (
                    <span
                      className="absolute top-0 h-full"
                      style={{
                        background: row.score >= 0 ? "var(--up)" : "var(--down)",
                        width: `${Math.min(100, Math.abs(row.score)) / 2}%`,
                        left: row.score >= 0 ? "50%" : `${50 - Math.min(100, Math.abs(row.score)) / 2}%`,
                      }}
                    />
                  ) : null}
                </div>
                <span className={`num w-10 text-right ${row.score === null ? "text-ice" : row.score >= 0 ? "text-up" : "text-down"}`}>
                  {row.score === null ? "–" : signed(row.score, 0)}
                </span>
                <span className="num w-10 text-right text-ice">{Math.round(row.weight * 100)}%</span>
              </div>
            ))}
            <p className="text-xs text-ice">Kolom terakhir adalah bobot tiap faktor dalam skor gabungan.</p>
          </div>

          <div className="grid grid-cols-4 gap-px bg-rib text-center">
            {[
              { k: "Acuan", v: signal.entry, c: "text-paper" },
              { k: "Stop", v: signal.stop, c: "text-down" },
              { k: "Target 1", v: signal.tp1, c: "text-up" },
              { k: "Target 2", v: signal.tp2, c: "text-up" },
            ].map((cell) => (
              <div key={cell.k} className="bg-hull px-1 py-2">
                <div className="text-xs text-ice">{cell.k}</div>
                <div className={`num text-sm ${cell.c}`}>{cell.v ? fmtPrice(cell.v) : "–"}</div>
              </div>
            ))}
          </div>

          <div className="mt-auto flex flex-wrap gap-2">
            <button className="btn btn-gold" onClick={onLog} disabled={signal.action === "TUNGGU"}>
              Catat ke jurnal
            </button>
            <button className="btn" onClick={onToggleNotify} aria-pressed={notifyOn}>
              {notifyOn ? "Matikan notifikasi" : "Nyalakan notifikasi"}
            </button>
          </div>
        </>
      ) : (
        <p className="text-[13px] text-ice">Menunggu data harga, kalender, dan berita.</p>
      )}
    </div>
  );
}
