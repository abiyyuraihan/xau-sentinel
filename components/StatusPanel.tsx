import type { SourceAttempt } from "@/lib/types";
import { Panel } from "./ui";

export default function StatusPanel({
  groups,
  errors,
  onRefresh,
}: {
  groups: { name: string; attempts: SourceAttempt[] }[];
  errors: string[];
  onRefresh: () => void;
}) {
  return (
    <Panel
      title="Status sumber data"
      meta={
        <button className="btn !px-2 !py-1 !text-xs" onClick={onRefresh}>
          Muat ulang data
        </button>
      }
      bodyClassName="flex flex-col gap-4"
    >
      {errors.map((e) => (
        <p key={e} className="border border-down/50 bg-down/10 p-2 text-[13px] text-down">
          {e}
        </p>
      ))}
      {groups.map((g) => (
        <div key={g.name}>
          <h3 className="sub-title">{g.name}</h3>
          {g.attempts.length === 0 ? (
            <p className="text-xs text-ice">Belum ada respons.</p>
          ) : (
            <ul className="grid gap-1.5">
              {g.attempts.map((a) => (
                <li key={a.name} className="flex items-start gap-2 text-[13px]">
                  <span className={`dot mt-1.5 ${a.ok ? "dot-up" : "dot-down"}`} />
                  <span className="min-w-0">
                    {a.name}
                    <span className="block break-words text-xs text-ice">{a.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <p className="text-xs text-ice">
        Titik merah berarti sumber itu gagal dijawab server. Penyebab dan cara memperbaikinya ada di README bagian Pemecahan masalah.
      </p>
    </Panel>
  );
}
