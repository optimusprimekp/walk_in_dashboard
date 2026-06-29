import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@/api/custom-fetch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Users, CheckCircle2, Download } from "lucide-react";

function exportCsv(sites: OpeningsSite[]) {
  const headers = ["Department", "Site", "Position", "Planned Openings", "Selected", "Fill %"];
  const lines: string[] = [];
  for (const s of sites) {
    for (const p of s.positions) {
      const pct = p.openings > 0 ? ((p.selected / p.openings) * 100).toFixed(1) : "—";
      lines.push([
        `"${s.department}"`,
        `"${s.site}"`,
        `"${p.position}"`,
        p.openings,
        p.selected,
        pct,
      ].join(","));
    }
  }
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `openings-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type OpeningsPos = { position: string; openings: number; selected: number };
type OpeningsSite = { site: string; department: string; openings: number; selected: number; positions: OpeningsPos[] };
type OpeningsData = { totals: { openings: number; selected: number }; sites: OpeningsSite[] };

export default function OpeningsDashboard() {
  const [, setLocation] = useLocation();
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) setLocation("/login");
  }, [setLocation]);

  const { data, isLoading } = useQuery<OpeningsData>({
    queryKey: ["openings"],
    queryFn: () => customFetch<OpeningsData>("/api/dashboard/openings"),
    refetchInterval: 10000,
  });

  const sites = data?.sites ?? [];
  const withSelections = sites.filter((s) => s.selected > 0);
  const visible = showAll ? sites : withSelections;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation("/")} className="px-2 -ml-2">&larr; Back</Button>
            <img src="/kp-logo.png" alt="KP Group" className="h-8 w-8 object-contain" />
            <div>
              <h1 className="font-semibold text-lg leading-none">Openings &amp; Selections</h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                {data ? `${data.totals.selected} selected · ${data.totals.openings} planned openings` : "Loading…"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              Show sites with no selections
            </label>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!data || sites.length === 0}
              onClick={() => data && exportCsv(showAll ? sites : sites)}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-[1700px]">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : visible.length === 0 ? (
          <div className="border-2 border-dashed border-zinc-200 rounded-xl p-12 text-center text-zinc-400">
            No candidates selected yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {visible.map((site) => (
              <Card key={site.site} className="border-zinc-200 bg-white shadow-sm">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="font-semibold text-zinc-900 truncate">{site.site}</span>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold whitespace-nowrap">
                      {site.selected} selected
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {site.positions
                      .filter((p) => showAll || p.selected > 0)
                      .map((p) => {
                        const pct = p.openings > 0 ? Math.min(100, Math.round((p.selected / p.openings) * 100)) : 0;
                        const over = p.openings > 0 && p.selected > p.openings;
                        return (
                          <div key={p.position}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="font-medium text-zinc-700 truncate">{p.position}</span>
                              <span className={`font-semibold flex items-center gap-1 ${over ? "text-destructive" : "text-zinc-900"}`}>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                {p.selected}
                                <span className="text-zinc-400 font-normal">/ {p.openings || "—"}</span>
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${over ? "bg-destructive" : "bg-emerald-500"}`}
                                style={{ width: `${p.openings > 0 ? pct : (p.selected > 0 ? 100 : 0)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center gap-2 text-xs text-zinc-400">
                    <Users className="w-3.5 h-3.5" />
                    {site.selected} of {site.openings || "—"} openings filled
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
