import { useEffect, useState } from "react";
import { useGetTvDisplay } from "@/api";
import { Loader2 } from "lucide-react";
import { FullscreenButton } from "@/components/fullscreen-button";

export default function TvCalling() {
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

  const tokens = data.tokens ?? [];
  const calling = tokens.filter((t) => t.status === "ASSIGNED" || t.status === "IN_INTERVIEW");

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans select-none">
      <header className="px-8 py-4 border-b border-white/10 flex justify-between items-center bg-black shrink-0">
        <div className="flex items-center gap-4">
          <img src="/kp-logo.png" alt="KP Group" className="h-12 w-12 object-contain bg-white rounded p-0.5" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">KP Group of Companies</h1>
            <p className="text-zinc-400 font-medium tracking-wide text-sm">Now Calling</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-4xl font-bold font-mono tracking-tighter text-zinc-100">
              {now.toLocaleTimeString("en-US", { hour12: false })}
            </div>
            <div className="text-zinc-400 font-medium text-sm">
              {now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </div>
          </div>
          <FullscreenButton />
        </div>
      </header>

      <div className="flex-1 px-6 py-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-4 w-4 rounded-full bg-primary animate-pulse" />
          <h2 className="text-3xl font-black tracking-widest text-primary uppercase">Now Calling</h2>
          <span className="ml-1 text-lg font-semibold text-zinc-500">{calling.length} active</span>
        </div>

        {calling.length > 0 ? (
          <div className="grid grid-cols-5 gap-3">
            {calling.map((token) => {
              const inInterview = token.status === "IN_INTERVIEW";
              return (
                <div key={token.id} className="rounded-xl overflow-hidden shadow-lg border border-white/10">
                  <div className={`px-3 py-3 flex flex-col items-center text-center ${inInterview ? "bg-emerald-600" : "bg-primary"}`}>
                    <span className="text-[10px] font-bold tracking-widest text-white/70 uppercase">Token</span>
                    <span className="text-4xl font-black text-white tracking-tighter leading-none">{token.tokenNo}</span>
                    <span className="text-sm font-semibold text-white/90 mt-1 truncate max-w-full">{token.candidateName}</span>
                  </div>
                  <div className="bg-white flex justify-between items-center px-3 py-2">
                    <span className="text-black font-bold text-[10px] tracking-wide uppercase">
                      {inInterview ? "In Interview" : "Proceed To"}
                    </span>
                    <span className={`font-black text-xl whitespace-nowrap ${inInterview ? "text-emerald-700" : "text-primary"}`}>
                      TABLE {token.assignedTableNo}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-48 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center text-white/30 text-2xl font-semibold tracking-wide">
            Waiting for candidates…
          </div>
        )}
      </div>
    </div>
  );
}
