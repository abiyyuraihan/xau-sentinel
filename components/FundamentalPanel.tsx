"use client";

import { useMemo, useState } from "react";
import { computeSurprise, isQualitative, ruleFor, scenarioFor } from "@/lib/fundamentals";
import type { SurpriseEntry } from "@/lib/signal";
import type { CalendarEvent, OfficialPrint } from "@/lib/types";
import { Panel, fmtDayTime, signed } from "./ui";

type Props = {
  events: CalendarEvent[];
  official: OfficialPrint[];
  loaded: boolean;
  now: number | null;
  surprise: SurpriseEntry | null;
  onSurprise: (entry: SurpriseEntry | null) => void;
};

const fmtOfficial = (p: OfficialPrint, v: number) => (p.unit === "K" ? `${Math.round(v)}K` : `${v.toFixed(1)}%`);

export default function FundamentalPanel({ events, official, loaded, now, surprise, onSurprise }: Props) {
  const usd = useMemo(
    () => events.filter((e) => e.country === "USD" && (e.impact === "High" || e.impact === "Medium")),
    [events],
  );
  const scorable = useMemo(() => usd.filter((e) => ruleFor(e.title) && e.forecast), [usd]);

  // Pilihan bawaan: rilis yang baru lewat (maks. 4 jam), kalau tidak ada, rilis berikutnya.
  const suggested = useMemo(() => {
    if (!now || scorable.length === 0) return null;
    const recent = [...scorable].reverse().find((e) => e.time <= now && now - e.time < 4 * 3600_000 && e.impact === "High");
    const upcoming = scorable.find((e) => e.time > now && e.impact === "High") ?? scorable.find((e) => e.time > now);
    return recent ?? upcoming ?? scorable[scorable.length - 1];
  }, [scorable, now]);

  const [pickedId, setPickedId] = useState<string | null>(null);
  const [actual, setActual] = useState("");
  const picked = scorable.find((e) => e.id === pickedId) ?? suggested;
  const scenario = picked ? scenarioFor(picked) : null;
  const rule = picked ? ruleFor(picked.title) : null;
  const officialPrint = rule?.official ? official.find((o) => o.key === rule.official) : undefined;
  const preview = picked && actual.trim() ? computeSurprise(picked.title, actual, picked.forecast) : null;
  const released = picked && now ? picked.time <= now : false;

  const apply = () => {
    if (!picked || !preview) return;
    onSurprise({
      eventId: picked.id,
      title: picked.title,
      actual: actual.trim(),
      forecast: picked.forecast,
      score: preview.score,
      at: Date.now(),
    });
  };

  return (
    <Panel title="Analisis fundamental" meta={<span className="chip">Rilis data AS</span>} bodyClassName="flex flex-col gap-4">
      {!loaded ? (
        <p className="text-[13px] text-ice">Memuat kalender.</p>
      ) : usd.length === 0 ? (
        <p className="text-[13px] text-ice">
          Kalender belum bisa dimuat, jadi skenario dan agenda tidak tersedia. Lihat panel Status sumber data untuk penyebabnya.
        </p>
      ) : (
        <>
          <div>
            <h3 className="sub-title">Skenario dan hasil rilis</h3>
            {picked ? (
              <div className="grid gap-3">
                <select
                  className="field"
                  value={picked.id}
                  onChange={(e) => {
                    setPickedId(e.target.value);
                    setActual("");
                  }}
                  aria-label="Pilih rilis data"
                >
                  {scorable.map((e) => (
                    <option key={e.id} value={e.id}>
                      {fmtDayTime(e.time)} | {e.title}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap gap-2">
                  <span className="chip">Perkiraan {picked.forecast}</span>
                  <span className="chip">Sebelumnya {picked.previous || "–"}</span>
                  <span className={`chip ${released ? "chip-gold" : ""}`}>{released ? "Sudah rilis" : "Belum rilis"}</span>
                </div>

                {scenario ? (
                  <div className="grid gap-px bg-rib sm:grid-cols-2">
                    <div className="bg-hull p-3">
                      <div className="text-xs text-ice">Aktual di atas perkiraan</div>
                      <div className={`font-display font-semibold ${scenario.higher.includes("naik") ? "text-up" : "text-down"}`}>
                        {scenario.higher}
                      </div>
                    </div>
                    <div className="bg-hull p-3">
                      <div className="text-xs text-ice">Aktual di bawah perkiraan</div>
                      <div className={`font-display font-semibold ${scenario.lower.includes("naik") ? "text-up" : "text-down"}`}>
                        {scenario.lower}
                      </div>
                    </div>
                    <p className="bg-hull p-3 text-xs text-ice sm:col-span-2">{scenario.why}</p>
                  </div>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    className="field num"
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    placeholder={`Angka aktual, format seperti ${picked.forecast}`}
                    aria-label="Angka aktual"
                    inputMode="decimal"
                  />
                  <button className="btn btn-gold" onClick={apply} disabled={!preview}>
                    Pakai hasil ini
                  </button>
                </div>

                {officialPrint ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ice">
                    <span>
                      Angka BLS terakhir: <b className="num text-paper">{fmtOfficial(officialPrint, officialPrint.value)}</b> untuk periode{" "}
                      {officialPrint.period}.
                    </span>
                    <button className="btn !px-2 !py-1 !text-xs" onClick={() => setActual(fmtOfficial(officialPrint, officialPrint.value))}>
                      Isi dengan angka ini
                    </button>
                    <span>Pastikan periodenya memang rilis yang kamu maksud.</span>
                  </div>
                ) : null}

                {actual.trim() && !preview ? (
                  <p className="text-xs text-down">Angka tidak terbaca. Tulis seperti perkiraannya, misalnya {picked.forecast}.</p>
                ) : null}
                {preview ? (
                  <p className={`text-[13px] ${preview.verdict === "bullish" ? "text-up" : preview.verdict === "bearish" ? "text-down" : "text-ice"}`}>
                    {preview.text} Skor rilis {signed(preview.score, 0)}.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-[13px] text-ice">Minggu ini tidak ada rilis berangka yang punya aturan arah.</p>
            )}

            {surprise ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-rib-2 bg-hull p-3 text-[13px]">
                <span>
                  Aktif di sinyal: <b>{surprise.title}</b>, aktual {surprise.actual} vs perkiraan {surprise.forecast}, skor{" "}
                  <b className={surprise.score >= 0 ? "text-up" : "text-down"}>{signed(surprise.score, 0)}</b>
                </span>
                <button className="btn !px-2 !py-1 !text-xs" onClick={() => onSurprise(null)}>
                  Hapus hasil
                </button>
              </div>
            ) : null}
          </div>

          <div>
            <h3 className="sub-title">Agenda USD minggu ini</h3>
            <div className="scroll max-h-56 border border-rib">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Waktu lokal</th>
                    <th>Rilis</th>
                    <th>Perkiraan</th>
                    <th>Sebelumnya</th>
                  </tr>
                </thead>
                <tbody>
                  {usd.map((e) => {
                    const past = now ? e.time < now : false;
                    return (
                      <tr key={e.id} style={{ opacity: past ? 0.5 : 1 }}>
                        <td className="num text-ice">{fmtDayTime(e.time)}</td>
                        <td className="!whitespace-normal">
                          <span className="flex items-center gap-2">
                            <span className={`dot ${e.impact === "High" ? "dot-gold" : ""}`} />
                            {e.title}
                            {isQualitative(e.title) ? <span className="chip">baca nadanya</span> : null}
                          </span>
                        </td>
                        <td className="num">{e.forecast || "–"}</td>
                        <td className="num text-ice">{e.previous || "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-ice">
              Titik emas menandai dampak tinggi. Pidato dan pernyataan FOMC tidak punya angka, jadi tidak bisa dihitung otomatis.
            </p>
          </div>
        </>
      )}

      {official.length > 0 ? (
        <div>
          <h3 className="sub-title">Angka resmi terakhir dari BLS</h3>
          <div className="grid grid-cols-2 gap-px bg-rib sm:grid-cols-4">
            {official.map((p) => (
              <div key={p.key} className="bg-hull p-2.5">
                <div className="text-xs text-ice">{p.label}</div>
                <div className="num text-base">{fmtOfficial(p, p.value)}</div>
                <div className="text-xs text-ice">
                  {p.period}
                  {p.previous !== null ? `, sebelumnya ${fmtOfficial(p, p.previous)}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
