import { useEffect, useState } from "react";
import { useGetTvDisplay } from "@/api";
import { Loader2 } from "lucide-react";
import { FullscreenButton } from "@/components/fullscreen-button";

type QueueRow = {
  id: number;
  tokenNo: string;
  candidateName?: string;
  queuePosition?: number | null;
};

function QueueColumn({ rows }: { rows: QueueRow[] }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 text-zinc-500 font-semibold text-[11px] tracking-widest uppercase shrink-0">
        <span>Token / Candidate</span>
        <span>#</span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {rows.map((token, i) => (
          <div
            key={token.id}
            className={`flex items-center gap-2 px-3 py-1 border-b border-white/5 ${i % 2 === 0 ? "bg-zinc-900/50" : ""}`}
          >
            <span className="font-mono font-bold text-base text-zinc-100 w-14 shrink-0">{token.tokenNo}</span>
            <span className="flex-1 min-w-0 truncate text-sm text-zinc-300">{token.candidateName}</span>
            <span className="text-xs text-zinc-500 font-mono shrink-0">#{token.queuePosition ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TvWaiting() {
  const { data, isLoading } = useGetTvDisplay({
    query: { refetchInterval: 5000 } as any,
  });
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (isLoading && !data) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  if (!data) return null;

  const waiting = (data.tokens ?? []).filter((t) => t.status === "WAITING");
  const per = Math.ceil(waiting.length / 3);
  const cols = [waiting.slice(0, per), waiting.slice(per, per * 2), waiting.slice(per * 2)];

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col font-sans select-none overflow-hidden">
      <header className="px-6 py-3 border-b border-white/10 flex justify-between items-center bg-black shrink-0">
        <div className="flex items-center gap-3">
          <img src="/kp-logo.png" alt="KP Group" className="h-10 w-10 object-contain bg-white rounded p-0.5" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">KP Group of Companies</h1>
            <p className="text-zinc-400 font-medium tracking-wide text-xs">Waiting Queue</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-3xl font-bold font-mono tracking-tighter text-zinc-100">
              {now.toLocaleTimeString("en-US", { hour12: false })}
            </div>
            <div className="text-zinc-400 font-medium text-xs">{waiting.length} waiting</div>
          </div>
          <FullscreenButton />
        </div>
      </header>

      <div className="px-6 pt-3 pb-1 shrink-0">
        <h2 className="text-xl font-black tracking-widest text-zinc-200 uppercase">Up Next — Waiting Queue</h2>
      </div>

      {waiting.length > 0 ? (
        <div className="flex-1 min-h-0 px-6 pb-4 flex gap-5">
          <QueueColumn rows={cols[0]} />
          <div className="w-px bg-white/10" />
          <QueueColumn rows={cols[1]} />
          <div className="w-px bg-white/10" />
          <QueueColumn rows={cols[2]} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-white/30 text-2xl font-semibold tracking-wide">
          Queue is empty
        </div>
      )}
    </div>
  );
}
