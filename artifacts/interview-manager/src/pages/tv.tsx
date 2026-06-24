import { useEffect, useRef, useState } from "react";
import { useGetTvDisplay } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import QRCode from "qrcode";

function QrCanvas({ url, size = 100 }: { url: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current && url) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: size,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
    }
  }, [url, size]);
  return <canvas ref={canvasRef} />;
}

function getCheckinUrl() {
  return `${window.location.origin}/checkin`;
}

export default function TvDisplay() {
  const { data, isLoading } = useGetTvDisplay({
    query: { refetchInterval: 5000 } as any,
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const calling = data.nowCalling ?? [];
  const queueTokens = data.tokens ?? [];

  // Grid columns for now-calling cards based on count
  const callingColClass =
    calling.length === 1
      ? "grid-cols-1"
      : calling.length === 2
      ? "grid-cols-2"
      : calling.length === 3
      ? "grid-cols-3"
      : "grid-cols-4";

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col overflow-hidden font-sans select-none">

      {/* ── HEADER ── */}
      <header className="px-8 py-4 border-b border-white/10 flex justify-between items-center bg-black shrink-0">
        <div className="flex items-center gap-4">
          <img src="/kp-logo.png" alt="KP Group" className="h-12 w-12 object-contain bg-white rounded p-0.5" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">KP Group of Companies</h1>
            <p className="text-zinc-400 font-medium tracking-wide text-sm">Walk-In Interview — Queue Status</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold font-mono tracking-tighter text-zinc-100">
            {currentTime.toLocaleTimeString("en-US", { hour12: false })}
          </div>
          <div className="text-zinc-400 font-medium text-sm">
            {currentTime.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </div>
        </div>
      </header>

      {/* ── NOW CALLING — full-width, dominant section ── */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-4 w-4 rounded-full bg-primary animate-pulse" />
          <h2 className="text-3xl font-black tracking-widest text-primary uppercase">Now Calling</h2>
        </div>

        {calling.length > 0 ? (
          <div className={`grid ${callingColClass} gap-4`}>
            {calling.map((token) => (
              <div
                key={token.id}
                className="rounded-2xl overflow-hidden shadow-2xl border border-primary/30"
              >
                {/* Top: token + name */}
                <div className="bg-primary px-8 py-6 flex flex-col items-center text-center">
                  <span className="text-sm font-bold tracking-widest text-primary-foreground/70 uppercase mb-1">
                    Token Number
                  </span>
                  <span
                    className={`font-black text-white tracking-tighter leading-none ${
                      calling.length === 1
                        ? "text-[12rem]"
                        : calling.length === 2
                        ? "text-[8rem]"
                        : "text-[6rem]"
                    }`}
                    style={{ lineHeight: 1 }}
                  >
                    {token.tokenNo}
                  </span>
                  <span className="text-xl font-semibold text-primary-foreground/90 mt-2 truncate max-w-full">
                    {token.candidateName}
                  </span>
                </div>

                {/* Bottom: table number */}
                <div className="bg-white flex justify-between items-center px-8 py-4">
                  <span className="text-black font-bold text-xl tracking-wide uppercase">Proceed To</span>
                  <span
                    className={`font-black text-primary ${
                      calling.length === 1 ? "text-6xl" : "text-4xl"
                    }`}
                  >
                    TABLE {token.assignedTableNo}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-36 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center text-white/30 text-2xl font-semibold tracking-wide">
            Waiting for candidates...
          </div>
        )}
      </div>

      {/* ── QUEUE + QR ── */}
      <div className="flex-1 flex flex-row px-6 pb-4 gap-4 min-h-0">

        {/* Queue table */}
        <div className="flex-1 flex flex-col bg-zinc-900 rounded-xl border border-white/5 overflow-hidden min-h-0">
          <div className="shrink-0 px-5 py-3 border-b border-white/5 bg-zinc-950/60">
            <h3 className="text-lg font-bold uppercase tracking-widest text-zinc-300">Up Next — Waiting Queue</h3>
          </div>
          <div className="grid grid-cols-12 gap-2 px-5 py-2 border-b border-white/5 bg-zinc-950/30 text-zinc-500 font-semibold text-xs tracking-widest uppercase shrink-0">
            <div className="col-span-3">Token</div>
            <div className="col-span-5">Candidate</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-right">Queue #</div>
          </div>
          <div className="flex-1 overflow-auto">
            {queueTokens.length > 0 ? (
              queueTokens.map((token, index) => (
                <div
                  key={token.id}
                  className={`grid grid-cols-12 gap-2 px-5 py-3 items-center border-b border-white/5 ${
                    index % 2 === 0 ? "bg-zinc-900/60" : "bg-transparent"
                  }`}
                >
                  <div className="col-span-3 text-2xl font-bold text-zinc-100 font-mono">{token.tokenNo}</div>
                  <div className="col-span-5 font-medium text-lg text-zinc-300 truncate">{token.candidateName}</div>
                  <div className="col-span-2">
                    <Badge
                      variant="outline"
                      className={`font-bold px-3 py-1 text-xs border-0 ${
                        token.status === "ASSIGNED"
                          ? "bg-amber-500/20 text-amber-400"
                          : token.status === "WAITING"
                          ? "bg-zinc-500/20 text-zinc-400"
                          : token.status === "IN_INTERVIEW"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-zinc-700/20 text-zinc-500"
                      }`}
                    >
                      {token.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-right text-xl font-medium text-zinc-500 font-mono">
                    #{token.queuePosition ?? "—"}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-600 font-medium text-lg">
                Queue is empty
              </div>
            )}
          </div>
        </div>

        {/* Right column: stats + QR */}
        <div className="w-56 shrink-0 flex flex-col gap-4">
          {/* Stats */}
          <div className="bg-zinc-900 rounded-xl border border-white/5 p-5 flex flex-col gap-4">
            {[
              { label: "Waiting", value: data.stats?.waiting ?? 0, color: "text-zinc-100" },
              { label: "In Interview", value: data.stats?.inInterview ?? 0, color: "text-emerald-400" },
              { label: "Completed", value: data.stats?.completed ?? 0, color: "text-zinc-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className={`text-4xl font-black ${color}`}>{value}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* QR Code */}
          <div className="bg-zinc-900 rounded-xl border border-white/5 p-4 flex flex-col items-center gap-3 flex-1 justify-center">
            <div className="bg-white rounded-lg p-1.5">
              <QrCanvas url={getCheckinUrl()} size={120} />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Self Check-In</p>
              <p className="text-xs text-zinc-500 mt-1">Scan QR to register</p>
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-500 text-xs font-bold uppercase tracking-widest">System Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
