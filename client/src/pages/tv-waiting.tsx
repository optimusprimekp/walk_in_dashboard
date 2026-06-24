import { useEffect, useState } from "react";
import { useGetTvDisplay } from "@/api";
import { Loader2 } from "lucide-react";

type QueueRow = {
  id: number;
  tokenNo: string;
  candidateName?: string;
  queuePosition?: number | null;
};

function QueueColumn({ rows }: { rows: QueueRow[] }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/5 text-zinc-500 font-semibold text-xs tracking-widest uppercase">
        <div className="col-span-3">Token</div>
        <div className="col-span-7">Candidate</div>
        <div className="col-span-2 text-right">#</div>
      </div>
      {rows.map((token, i) => (
        <div
          key={token.id}
          className={`grid grid-cols-12 gap-2 px-4 py-2 items-center border-b border-white/5 ${i % 2 === 0 ? "bg-zinc-900/60" : ""}`}
        >
          <div className="col-span-3 text-xl font-bold text-zinc-100 font-mono">{token.tokenNo}</div>
          <div className="col-span-7 font-medium text-base text-zinc-300 truncate">{token.candidateName}</div>
          <div className="col-span-2 text-right text-base font-medium text-zinc-500 font-mono">
            #{token.queuePosition ?? "—"}
          </div>
        </div>
      ))}
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  if (!data) return null;

  const waiting = (data.tokens ?? []).filter((t) => t.status === "WAITING");
  const mid = Math.ceil(waiting.length / 2);
  const col1 = waiting.slice(0, mid);
  const col2 = waiting.slice(mid);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans select-none">
      <header className="px-8 py-4 border-b border-white/10 flex justify-between items-center bg-black shrink-0">
        <div className="flex items-center gap-4">
          <img src="/kp-logo.png" alt="KP Group" className="h-12 w-12 object-contain bg-white rounded p-0.5" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">KP Group of Companies</h1>
            <p className="text-zinc-400 font-medium tracking-wide text-sm">Waiting Queue</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold font-mono tracking-tighter text-zinc-100">
            {now.toLocaleTimeString("en-US", { hour12: false })}
          </div>
          <div className="text-zinc-400 font-medium text-sm">{waiting.length} waiting</div>
        </div>
      </header>

      <div className="flex-1 px-6 py-6">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-3xl font-black tracking-widest text-zinc-200 uppercase">Up Next — Waiting Queue</h2>
        </div>

        {waiting.length > 0 ? (
          <div className="flex gap-6">
            <QueueColumn rows={col1} />
            <div className="w-px bg-white/10" />
            <QueueColumn rows={col2} />
          </div>
        ) : (
          <div className="h-48 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center text-white/30 text-2xl font-semibold tracking-wide">
            Queue is empty
          </div>
        )}
      </div>
    </div>
  );
}
