"use client";

import { useState } from "react";
import type { Breaking, NewsPressure, PriceShock } from "@/lib/signal";
import type { NewsItem } from "@/lib/types";
import { Panel, signed, timeAgo } from "./ui";

type Props = {
  items: NewsItem[];
  loaded: boolean;
  now: number | null;
  breaking: Breaking | null;
  pressure: NewsPressure | null;
  shock: PriceShock | null;
};

const LEVEL_TEXT = { tenang: "Tenang", pantau: "Pantau", siaga: "Siaga" } as const;

export default function NewsPanel({ items, loaded, now, breaking, pressure, shock }: Props) {
  const [onlyScored, setOnlyScored] = useState(false);
  const shown = onlyScored ? items.filter((i) => i.score !== 0) : items;
  const level = breaking?.level ?? "tenang";
  const dirText = breaking?.dir === 1 ? "mendukung emas" : breaking?.dir === -1 ? "menekan emas" : "arah belum jelas";

  return (
    <Panel
      title="Berita mendadak"
      meta={
        <div className="seg" role="group" aria-label="Saring berita">
          <button aria-pressed={!onlyScored} onClick={() => setOnlyScored(false)}>
            Semua
          </button>
          <button aria-pressed={onlyScored} onClick={() => setOnlyScored(true)}>
            Berdampak
          </button>
        </div>
      }
      bodyClassName="flex flex-col gap-4"
    >
      <div className={`border border-rib p-3 ${level === "siaga" ? "alert-siaga" : level === "pantau" ? "alert-pantau" : ""}`} role="status">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-display text-base font-semibold">
            <span className={`dot ${level === "siaga" ? "dot-gold live-dot" : level === "pantau" ? "dot-up" : ""}`} />
            {LEVEL_TEXT[level]}
            {level !== "tenang" ? <span className="font-sans text-xs font-normal text-ice">{dirText}</span> : null}
          </span>
          <span className="flex gap-2">
            <span className="chip">
              Tekanan berita <b className="num text-paper">{pressure ? signed(pressure.pressure, 1) : "–"}</b>
            </span>
            <span className={`chip ${shock?.active ? "chip-gold" : ""}`}>
              Gerak harga <b className="num text-paper">{shock ? `${shock.multiple}× ATR` : "–"}</b>
            </span>
          </span>
        </div>
        <p className="mt-2 text-[13px] text-ice">{breaking?.reason ?? "Menunggu data berita."}</p>
      </div>

      <div className="scroll -mr-2 max-h-[520px] pr-2">
        {!loaded ? (
          <p className="text-[13px] text-ice">Memuat berita.</p>
        ) : shown.length === 0 ? (
          <p className="text-[13px] text-ice">
            {items.length === 0
              ? "Belum ada judul yang bisa ditampilkan. Periksa status tiap feed di panel Status sumber data."
              : "Tidak ada judul yang cocok dengan kamus kata kunci. Pilih Semua untuk melihat seluruh berita."}
          </p>
        ) : (
          <ul className="grid">
            {shown.map((it) => (
              <li key={it.id} className="border-b border-rib/60 py-2.5">
                <div className="flex items-start gap-3">
                  <span
                    className={`num mt-0.5 w-10 flex-none text-right text-[13px] ${it.score > 0 ? "text-up" : it.score < 0 ? "text-down" : "text-ice"}`}
                    title="Skor judul untuk emas"
                  >
                    {it.score === 0 ? "0" : signed(it.score, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={it.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] leading-snug text-paper hover:text-bullion"
                    >
                      {it.title}
                    </a>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ice">
                      <span>{it.source}</span>
                      <span>{now ? timeAgo(it.publishedAt, now) : ""}</span>
                      {it.urgent ? <span className="chip chip-gold">mendesak</span> : null}
                      {it.tags.map((t) => (
                        <span key={t} className={`chip ${it.score > 0 ? "chip-up" : it.score < 0 ? "chip-down" : ""}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-ice">
        Skor dihitung dari kata kunci di judul, bukan dari isi artikel. Positif berarti secara umum mendukung emas. Selalu baca beritanya sebelum bertindak.
      </p>
    </Panel>
  );
}
