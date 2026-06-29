import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Search, Users, IndianRupee, ArrowUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SelectedCandidate = {
  id: number;
  name: string;
  department: string | null;
  selectedPosition: string | null;
  selectedSite: string | null;
  currentCtc: string | null;
  negotiatedCtc: string | null;
  noticePeriod: number | null;
  tableNo: number | null;
  interviewerName: string | null;
};

function parseSalary(val: string | null): number {
  if (!val) return 0;
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function formatSalary(val: string | null): string {
  if (!val || val.trim() === "") return "—";
  return val.trim();
}

function calcHike(current: string | null, expected: string | null): string {
  const c = parseSalary(current);
  const e = parseSalary(expected);
  if (!c || !e) return "—";
  const pct = ((e - c) / c) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function exportCsv(rows: SelectedCandidate[]) {
  const headers = ["Name", "Department", "Table No", "Interviewer", "Offered Position", "Site", "Current On-hand Salary", "On-hand Expected Salary", "Hike %", "Notice Period (days)"];
  const lines = rows.map((r) => [
    `"${r.name}"`,
    `"${r.department ?? ""}"`,
    r.tableNo ?? "",
    `"${r.interviewerName ?? ""}"`,
    `"${r.selectedPosition ?? ""}"`,
    `"${r.selectedSite ?? ""}"`,
    `"${r.currentCtc ?? ""}"`,
    `"${r.negotiatedCtc ?? ""}"`,
    calcHike(r.currentCtc, r.negotiatedCtc),
    r.noticePeriod ?? "",
  ].join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `selected-candidates-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SelectedCandidates() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [salarySort, setSalarySort] = useState<"none" | "asc" | "desc">("none");
  const [tableSort, setTableSort] = useState<"none" | "asc" | "desc">("none");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) setLocation("/login");
  }, [setLocation]);

  const { data, isLoading } = useQuery<SelectedCandidate[]>({
    queryKey: ["selected-candidates"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/dashboard/selected-candidates", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return res.json();
    },
    refetchInterval: 10000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    let result = q
      ? data.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.selectedPosition ?? "").toLowerCase().includes(q) ||
            (c.selectedSite ?? "").toLowerCase().includes(q),
        )
      : [...data];
    if (salarySort === "asc") result.sort((a, b) => parseSalary(a.negotiatedCtc) - parseSalary(b.negotiatedCtc));
    if (salarySort === "desc") result.sort((a, b) => parseSalary(b.negotiatedCtc) - parseSalary(a.negotiatedCtc));
    if (tableSort === "asc") result.sort((a, b) => (a.tableNo ?? 999) - (b.tableNo ?? 999));
    if (tableSort === "desc") result.sort((a, b) => (b.tableNo ?? 0) - (a.tableNo ?? 0));
    return result;
  }, [data, search, salarySort, tableSort]);

  const totalCount = data?.length ?? 0;
  const totalSalary = useMemo(
    () => (data ?? []).reduce((sum, c) => sum + parseSalary(c.negotiatedCtc), 0),
    [data],
  );

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
            <Link href="/admin/reports" className="text-muted-foreground hover:text-foreground">Reports</Link>
            <Link href="/admin/selected" className="text-primary">Selected</Link>
            <span className="h-4 w-px bg-border" />
            <a href="/interviewer" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Interviewer ↗</a>
            <a href="/tv/calling" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Calling ↗</a>
            <a href="/tv/waiting" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Waiting ↗</a>
            <a href="/tv" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">TV ↗</a>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Selected Candidates</h2>
            <p className="text-muted-foreground mt-1">All candidates who have been selected.</p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            disabled={!data || data.length === 0}
            onClick={() => data && exportCsv(data)}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className="border-emerald-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-600">Total Selected</CardTitle>
              <Users className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-500">{totalCount}</div>
              <p className="text-xs text-muted-foreground mt-1">candidates selected</p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-600">Total Expected Salary</CardTitle>
              <IndianRupee className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-500">
                {totalSalary > 0 ? totalSalary.toLocaleString("en-IN") : "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">sum of on-hand expected salaries</p>
            </CardContent>
          </Card>
        </div>

        {/* Search + table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, position or site…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={tableSort} onValueChange={(v) => { setTableSort(v as typeof tableSort); setSalarySort("none"); }}>
                <SelectTrigger className="w-48 gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Sort by table" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default order</SelectItem>
                  <SelectItem value="asc">Table: 1 → Last</SelectItem>
                  <SelectItem value="desc">Table: Last → 1</SelectItem>
                </SelectContent>
              </Select>
              <Select value={salarySort} onValueChange={(v) => { setSalarySort(v as typeof salarySort); setTableSort("none"); }}>
                <SelectTrigger className="w-52 gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Sort by salary" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default order</SelectItem>
                  <SelectItem value="asc">Salary: Low → High</SelectItem>
                  <SelectItem value="desc">Salary: High → Low</SelectItem>
                </SelectContent>
              </Select>
              {search && (
                <span className="text-sm text-muted-foreground">
                  {filtered.length} of {totalCount}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex justify-center py-16 text-muted-foreground text-sm">
                {search ? "No candidates match your search." : "No selected candidates yet."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">#</TableHead>
                    <TableHead>Candidate Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Interviewer</TableHead>
                    <TableHead>Offered Position</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-right">Current On-hand</TableHead>
                    <TableHead className="text-right">Expected On-hand</TableHead>
                    <TableHead className="text-center">Hike</TableHead>
                    <TableHead className="text-center pr-6">Notice Period</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c, i) => (
                    <TableRow key={c.id}>
                      <TableCell className="pl-6 text-muted-foreground text-sm">{i + 1}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.department ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {c.tableNo != null ? `Table ${c.tableNo}` : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.interviewerName ?? "—"}</TableCell>
                      <TableCell>
                        {c.selectedPosition ? (
                          <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 font-medium">
                            {c.selectedPosition}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.selectedSite ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {formatSalary(c.currentCtc)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatSalary(c.negotiatedCtc)}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const h = calcHike(c.currentCtc, c.negotiatedCtc);
                          if (h === "—") return <span className="text-muted-foreground">—</span>;
                          const positive = h.startsWith("+");
                          return (
                            <Badge variant="outline" className={positive ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}>
                              {h}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-center pr-6">
                        {c.noticePeriod != null ? (
                          <Badge variant="outline" className="text-xs">
                            {c.noticePeriod} days
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
