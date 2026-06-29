import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type TableStat = {
  tableNo: number;
  interviewerName: string | null;
  selected: number;
  rejected: number;
};

export default function Reports() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) setLocation("/login");
  }, [setLocation]);

  const { data: tableStats, isLoading } = useQuery<TableStat[]>({
    queryKey: ["dashboard-table-stats"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/dashboard/table-stats", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return res.json();
    },
    refetchInterval: 10000,
  });

  const [sort, setSort] = useState<"table" | "selected" | "rejected">("table");

  const sortedStats = useMemo(() => {
    if (!tableStats) return [];
    return [...tableStats].sort((a, b) => {
      if (sort === "selected") return b.selected - a.selected;
      if (sort === "rejected") return b.rejected - a.rejected;
      return a.tableNo - b.tableNo;
    });
  }, [tableStats, sort]);

  const chartData = sortedStats.map((t) => ({
    name: t.interviewerName ? `T${t.tableNo} – ${t.interviewerName}` : `Table ${t.tableNo}`,
    Selected: t.selected,
    Rejected: t.rejected,
  }));

  const totalSelected = sortedStats.reduce((s, t) => s + t.selected, 0);
  const totalRejected = sortedStats.reduce((s, t) => s + t.rejected, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/kp-logo.png" alt="KP Group" className="h-9 w-9 object-contain" />
            <h1 className="font-semibold text-lg">KP Group of Companies</h1>
          </div>
          <nav className="flex items-center gap-5 text-sm font-medium flex-wrap justify-end">
            <Link href="/" className="text-muted-foreground hover:text-foreground">Dashboard</Link>
            <Link href="/candidates" className="text-muted-foreground hover:text-foreground">Candidates</Link>
            <Link href="/tables" className="text-muted-foreground hover:text-foreground">Tables</Link>
            <Link href="/admin/site-positions" className="text-muted-foreground hover:text-foreground">Site Positions</Link>
            <Link href="/admin/openings" className="text-muted-foreground hover:text-foreground">Openings</Link>
            <Link href="/admin/reports" className="text-primary">Reports</Link>
            <Link href="/admin/selected" className="text-muted-foreground hover:text-foreground">Selected</Link>
            <span className="h-4 w-px bg-border" />
            <a href="/interviewer" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Interviewer ↗</a>
            <a href="/tv/calling" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Calling ↗</a>
            <a href="/tv/waiting" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Waiting ↗</a>
            <a href="/tv" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">TV ↗</a>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
          <p className="text-muted-foreground mt-1">Table-wise interview outcome breakdown.</p>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-2 mb-8 max-w-sm">
          <Card className="border-emerald-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-600">Total Selected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">{totalSelected}</div>
            </CardContent>
          </Card>
          <Card className="border-destructive/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-destructive">Total Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{totalRejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Selected vs Rejected per Table</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex justify-center py-16 text-muted-foreground text-sm">
                No interview results yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={chartData}
                  margin={{ top: 4, right: 16, left: 0, bottom: 48 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend verticalAlign="top" />
                  <Bar dataKey="Selected" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Rejected" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Table breakdown */}
        {tableStats && tableStats.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Breakdown by Table</CardTitle>
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="table">Sort: Table No</SelectItem>
                  <SelectItem value="selected">Sort: Selected (High → Low)</SelectItem>
                  <SelectItem value="rejected">Sort: Rejected (High → Low)</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Table</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Interviewer</th>
                    <th className="text-center px-4 py-3 font-medium text-emerald-600">Selected</th>
                    <th className="text-center px-4 py-3 font-medium text-destructive">Rejected</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStats.map((t) => (
                    <tr key={t.tableNo} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">Table {t.tableNo}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.interviewerName ?? "—"}</td>
                      <td className="px-4 py-3 text-center font-semibold text-emerald-600">{t.selected}</td>
                      <td className="px-4 py-3 text-center font-semibold text-destructive">{t.rejected}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{t.selected + t.rejected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
