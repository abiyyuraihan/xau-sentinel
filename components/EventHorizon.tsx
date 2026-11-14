"use client";

import { useNow } from "@/lib/hooks";
import { nextHighImpact } from "@/lib/signal";
import type { CalendarEvent } from "@/lib/types";
import { countdown, fmtDayTime, zoneClock } from "./ui";

const DAY = 86400_000;

export default function EventHorizon({ events, loaded }: { events: CalendarEvent[]; loaded: boolean }) {
  const now = useNow(1000);
  const usd = events.filter((e) => e.country === "USD" && (e.impact === "High" || e.impact === "Medium"));
  const next = now ? nextHighImpact(events, now) : null;

  // Garis waktu: dari awal hari agenda pertama sampai akhir hari agenda terakhir.
  // Hari ini ikut ditampilkan bila masih berdekatan dengan agenda pertama.
  const firstEvent = usd[0]?.time ?? now ?? 0;
  const first = now && firstEvent - now < 7 * DAY ? Math.min(firstEvent, now) : firstEvent;
  const lastT = usd[usd.length - 1]?.time ?? first;
  const start = Math.floor(first / DAY) * DAY;
  const end = Math.max(start + DAY, Math.ceil((lastT + 1) / DAY) * DAY);
  const pos = (t: number) => `${Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100))}%`;
  const days = Array.from({ length: Math.round((end - start) / DAY) }, (_, i) => start + i * DAY);
  const dayName = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", timeZone: "UTC" });

  return (
    <section className="panel">
      <div className="grid gap-5 px-5 py-4 lg:grid-cols-[minmax(260px,340px)_1fr] lg:items-center">
        <div>
          <div className="text-xs text-ice">Rilis berdampak tinggi berikutnya (USD)</div>
          {next && now ? (
            <>
              <div className="mt-1 font-display text-lg font-semibold">{next.title}</div>
              <div className="num mt-1 text-3xl font-semibold text-bullion">{countdown(next.time - now)}</div>
              <div className="mt-1 text-xs text-ice">
                {fmtDayTime(next.time)} waktu lokal, {zoneClock(next.time, "America/New_York")} New York
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="chip">Perkiraan {next.forecast || "belum ada"}</span>
                <span className="chip">Sebelumnya {next.previous || "belum ada"}</span>
              </div>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-ice">
              {!loaded
                ? "Memuat kalender."
                : events.length === 0
                  ? "Kalender belum bisa dimuat. Lihat panel Status sumber data di bawah."
                  : "Tidak ada lagi rilis berdampak tinggi minggu ini. Kalender berganti saat minggu baru dimulai."}
            </p>
          )}
        </div>

        <div className={`min-w-0 ${usd.length === 0 ? "hidden" : ""}`}>
          <div className="relative h-16">
            <div className="absolute inset-x-0 top-8 h-px bg-rib-2" />
            {days.map((d) => (
              <div key={d} className="absolute top-0 h-full border-l border-rib" style={{ left: pos(d) }}>
                <span className="ml-1.5 text-xs text-ice">{dayName.format(d)}</span>
              </div>
            ))}
            {usd.map((e) => {
              const high = e.impact === "High";
              const past = now ? e.time < now : false;
              return (
                <div
                  key={e.id}
                  className="absolute"
                  style={{ left: pos(e.time), top: high ? 22 : 27, opacity: past ? 0.4 : 1 }}
                  title={`${e.title}, ${fmtDayTime(e.time)}`}
                >
                  <span
                    className="block -translate-x-1/2"
                    style={{
                      width: high ? 3 : 2,
                      height: high ? 20 : 10,
                      background: high ? "var(--bullion)" : "var(--plasma)",
                      boxShadow: high && !past ? "0 0 8px var(--bullion)" : "none",
                    }}
                  />
                </div>
              );
            })}
            {now && now >= start && now <= end ? (
              <div className="absolute top-4 h-10 w-px bg-paper" style={{ left: pos(now) }}>
                <span className="absolute -left-[3px] -top-1 block h-[7px] w-[7px] rotate-45 bg-paper" />
              </div>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-4 text-xs text-ice">
            <span className="flex items-center gap-1.5">
              <i className="block h-3 w-[3px] bg-bullion" /> Dampak tinggi
            </span>
            <span className="flex items-center gap-1.5">
              <i className="block h-2 w-[2px] bg-plasma" /> Dampak sedang
            </span>
            <span className="flex items-center gap-1.5">
              <i className="block h-[7px] w-[7px] rotate-45 bg-paper" /> Sekarang
            </span>
            <span>Hari mengikuti UTC</span>
          </div>
        </div>
      </div>
    </section>
  );
}
