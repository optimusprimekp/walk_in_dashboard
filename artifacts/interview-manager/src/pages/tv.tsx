import { useEffect, useRef, useState } from "react";
import { useGetTvDisplay } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
    query: { refetchInterval: 5000 },
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col overflow-hidden font-sans">
      <header className="px-8 py-6 border-b border-white/10 flex justify-between items-center bg-zinc-950">
        <div className="flex items-center gap-4">
          <img src="/kp-logo.png" alt="KP Group" className="h-12 w-12 object-contain bg-white rounded p-0.5" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">KP Group of Companies</h1>
            <p className="text-zinc-400 font-medium tracking-wide">Walk-In Interview — Queue Status</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold font-mono tracking-tighter text-zinc-100">
            {currentTime.toLocaleTimeString('en-US', { hour12: false })}
          </div>
          <div className="text-zinc-400 font-medium">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row p-6 gap-6 overflow-hidden">
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <h2 className="text-2xl font-bold tracking-tight text-primary uppercase flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
            Now Calling
          </h2>
          <div className="flex-1 flex flex-col gap-4">
            {data.nowCalling && data.nowCalling.length > 0 ? (
              data.nowCalling.slice(0, 3).map((token) => (
                <Card key={token.id} className="bg-primary border-none shadow-2xl overflow-hidden rounded-xl">
                  <CardContent className="p-0">
                    <div className="p-6 bg-black/20">
                      <div className="text-sm font-bold tracking-widest text-primary-foreground/80 uppercase mb-2">Token Number</div>
                      <div className="text-7xl font-bold text-white tracking-tighter mb-2">{token.tokenNo}</div>
                      <div className="text-xl text-primary-foreground/90 font-medium truncate">{token.candidateName}</div>
                    </div>
                    <div className="bg-white p-6 flex justify-between items-center">
                      <div className="text-black font-bold text-xl">PROCEED TO</div>
                      <div className="text-4xl font-bold text-primary">TABLE {token.assignedTableNo}</div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="flex-1 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-white/30 text-lg font-medium">
                Waiting for next candidate...
              </div>
            )}
          </div>

          <div className="bg-zinc-900 rounded-xl border border-white/10 p-4 flex items-center gap-4">
            <div className="bg-white rounded-lg p-1 flex-shrink-0">
              <QrCanvas url={getCheckinUrl()} size={80} />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Self Check-In</p>
              <p className="text-sm text-zinc-300 font-medium">Scan to register &amp; get your token</p>
              <p className="text-xs text-zinc-500 font-mono mt-1">/checkin</p>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-100 uppercase">Up Next</h2>
          <div className="flex-1 bg-zinc-900 rounded-xl border border-white/5 overflow-hidden flex flex-col">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 bg-zinc-950/50 text-zinc-400 font-medium text-sm tracking-wider uppercase">
              <div className="col-span-3">Token</div>
              <div className="col-span-5">Candidate</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Queue Pos</div>
            </div>
            <div className="flex-1 overflow-auto">
              {data.tokens && data.tokens.length > 0 ? (
                data.tokens.map((token, index) => (
                  <div key={token.id} className={`grid grid-cols-12 gap-4 p-4 items-center border-b border-white/5 ${index % 2 === 0 ? 'bg-zinc-900/50' : 'bg-transparent'}`}>
                    <div className="col-span-3 text-2xl font-bold text-zinc-100 font-mono">{token.tokenNo}</div>
                    <div className="col-span-5 font-medium text-lg text-zinc-300 truncate">{token.candidateName}</div>
                    <div className="col-span-2">
                      <Badge variant="outline" className={`
                        font-bold px-3 py-1 text-sm border-0
                        ${token.status === 'ASSIGNED' ? 'bg-amber-500/20 text-amber-500' : ''}
                        ${token.status === 'WAITING' ? 'bg-zinc-500/20 text-zinc-400' : ''}
                        ${token.status === 'IN_INTERVIEW' ? 'bg-emerald-500/20 text-emerald-500' : ''}
                      `}>
                        {token.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="col-span-2 text-right text-xl font-medium text-zinc-500 font-mono">
                      #{token.queuePosition || '-'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-600 font-medium">
                  Queue is empty
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-zinc-950 border-t border-white/10 p-4 px-8">
        <div className="flex justify-between items-center text-sm font-medium">
          <div className="flex gap-8">
            <div className="flex items-center gap-2">
              <div className="text-zinc-500 uppercase tracking-wider text-xs">Total Waiting</div>
              <div className="text-2xl font-bold text-zinc-100">{data.stats?.waiting || 0}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-zinc-500 uppercase tracking-wider text-xs">In Interview</div>
              <div className="text-2xl font-bold text-zinc-100">{data.stats?.inInterview || 0}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-zinc-500 uppercase tracking-wider text-xs">Completed Today</div>
              <div className="text-2xl font-bold text-zinc-100">{data.stats?.completed || 0}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-emerald-500 uppercase tracking-wider text-xs font-bold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              System Live
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
