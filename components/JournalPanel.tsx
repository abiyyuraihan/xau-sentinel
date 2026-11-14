"use client";

import { toCsv, type JournalEntry } from "@/lib/journal";
import { Panel, fmtDayTime, fmtPrice, signed } from "./ui";

export default function JournalPanel({
  entries,
  price,
  onRemove,
  onClear,
  autoLog,
  onToggleAuto,
}: {
  autoLog: boolean;
  onToggleAuto: () => void;
  entries: JournalEntry[];
  price: number | null;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const closed = entries.filter((e) => e.result);
  const wins = closed.filter((e) => e.result === "TP1").length;

  const download = () => {
    const blob = new Blob([toCsv(entries)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jurnal-sinyal-xau.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel
      title="Jurnal sinyal"
      meta={
        <>
          <span className="chip">
            {closed.length ? `${wins} dari ${closed.length} kena target lebih dulu` : "Belum ada hasil"}
          </span>
          <button className="btn !px-2 !py-1 !text-xs" onClick={onToggleAuto} aria-pressed={autoLog}>
            <span className={`dot ${autoLog ? "dot-up" : ""}`} />
            Catat otomatis: {autoLog ? "nyala" : "mati"}
          </button>
          <button className="btn !px-2 !py-1 !text-xs" onClick={download} disabled={entries.length === 0}>
            Unduh CSV
          </button>
          <button
            className="btn !px-2 !py-1 !text-xs"
            disabled={entries.length === 0}
            onClick={() => {
              if (window.confirm("Hapus semua catatan jurnal di browser ini?")) onClear();
            }}
          >
            Hapus semua
          </button>
        </>
      }
    >
      {entries.length === 0 ? (
        <p className="text-[13px] text-ice">
          Jurnal masih kosong. {autoLog
            ? "Catat otomatis menyala: begitu sinyal menunjukkan beli atau jual, level-levelnya langsung tersimpan di sini selama halaman ini terbuka."
            : "Catat otomatis mati: tekan Catat ke jurnal saat sinyal menunjukkan beli atau jual."}{" "}
          Hasilnya dicek terhadap harga berikutnya, jadi kamu bisa membandingkannya dengan akun demo.
        </p>
      ) : (
        <div className="scroll max-h-72 overflow-x-auto">
          <table className="grid-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Mode</th>
                <th>Arah</th>
                <th>Acuan</th>
                <th>Stop</th>
                <th>Target 1</th>
                <th>Skor</th>
                <th>Hasil</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const floating = price !== null ? (price - e.entry) * (e.action === "BELI" ? 1 : -1) : null;
                return (
                  <tr key={e.id}>
                    <td className="num text-ice">{fmtDayTime(e.at)}</td>
                    <td>
                      {e.mode}
                      {e.auto ? <span className="chip ml-2">otomatis</span> : null}
                      {e.source === "demo" ? <span className="chip chip-down ml-2">simulasi</span> : null}
                    </td>
                    <td className={`font-display font-semibold ${e.action === "BELI" ? "text-up" : "text-down"}`}>{e.action}</td>
                    <td className="num">{fmtPrice(e.entry)}</td>
                    <td className="num text-down">{fmtPrice(e.stop)}</td>
                    <td className="num text-up">{fmtPrice(e.tp1)}</td>
                    <td className="num">{signed(e.score, 0)}</td>
                    <td className="num">
                      {e.result === "TP1" ? (
                        <span className="text-up">Target 1</span>
                      ) : e.result === "SL" ? (
                        <span className="text-down">Stop</span>
                      ) : floating !== null ? (
                        <span className={floating >= 0 ? "text-up" : "text-down"}>terbuka {signed(floating)}</span>
                      ) : (
                        "terbuka"
                      )}
                    </td>
                    <td>
                      <button className="btn !px-2 !py-0.5 !text-xs" onClick={() => onRemove(e.id)} aria-label="Hapus catatan ini">
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
