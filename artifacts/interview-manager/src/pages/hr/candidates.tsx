import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useListCandidates, useImportCandidates } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Download, Settings, CheckCircle2, AlertCircle, RefreshCw, X, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SHEET_URL_KEY = "kp_fixed_sheet_url";
const IMPORT_INTERVAL_MS = 10000;

type ParsedRow = {
  name: string; mobile: string; email: string; position: string;
  experience?: string; currentCompany?: string; currentDesignation?: string; location?: string;
};

type ImportStatus = "idle" | "importing" | "success" | "error";

export default function Candidates() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showSettings, setShowSettings] = useState(false);
  const [sheetUrlInput, setSheetUrlInput] = useState(() => localStorage.getItem(SHEET_URL_KEY) || "");
  const [savedSheetUrl, setSavedSheetUrl] = useState(() => localStorage.getItem(SHEET_URL_KEY) || "");

  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importMessage, setImportMessage] = useState("");
  const [lastImportTime, setLastImportTime] = useState<Date | null>(null);
  const isImportingRef = useRef(false);

  const { data: candidates, isLoading } = useListCandidates(undefined, { query: { refetchInterval: 8000 } as any });
  const importMutation = useImportCandidates();

  const doImport = useCallback(async (url: string, silent = true) => {
    if (!url || isImportingRef.current) return;
    isImportingRef.current = true;
    if (!silent) setImportStatus("importing");
    else setImportStatus("importing");

    try {
      const resp = await fetch(`/api/candidates/fetch-sheet?url=${encodeURIComponent(url)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      const data = await resp.json();
      if (!resp.ok || !data.rows || data.rows.length === 0) {
        setImportStatus("error");
        setImportMessage(data.error || "No rows in sheet");
        setTimeout(() => setImportStatus("idle"), 4000);
        return;
      }
      const rows: ParsedRow[] = data.rows;
      await new Promise<void>((resolve, reject) => {
        importMutation.mutate({ data: { candidates: rows } }, {
          onSuccess: (result) => {
            queryClient.invalidateQueries();
            setLastImportTime(new Date());
            setImportMessage(`+${result.imported} new · ${result.skipped} skipped`);
            setImportStatus("success");
            setTimeout(() => setImportStatus("idle"), 4000);
            resolve();
          },
          onError: (e) => {
            setImportStatus("error");
            setImportMessage("Import failed");
            setTimeout(() => setImportStatus("idle"), 4000);
            reject(e);
          }
        });
      });
    } catch {
      setImportStatus("error");
      setImportMessage("Network error");
      setTimeout(() => setImportStatus("idle"), 4000);
    } finally {
      isImportingRef.current = false;
    }
  }, [importMutation, queryClient]);

  useEffect(() => {
    if (!savedSheetUrl) return;
    doImport(savedSheetUrl);
    const interval = setInterval(() => doImport(savedSheetUrl), IMPORT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [savedSheetUrl]);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) setLocation("/login");
  }, [setLocation]);

  const handleSaveUrl = () => {
    const trimmed = sheetUrlInput.trim();
    localStorage.setItem(SHEET_URL_KEY, trimmed);
    setSavedSheetUrl(trimmed);
    setShowSettings(false);
    if (trimmed) doImport(trimmed, false);
  };

  const exportCsv = () => {
    if (!candidates) return;
    const headers = ["Ref ID", "Token", "Name", "Mobile", "Email", "Position Applied", "Current Company", "Designation", "Experience", "Status", "Current CTC", "Negotiated CTC", "Site Offered", "Position Offered", "Interviewer Comments"];
    const rows = (filteredCandidates || []).map(c => [
      c.candidateRef || "",
      c.tokenNo || "",
      c.name,
      c.mobile,
      c.email,
      c.position,
      c.currentCompany || "",
      c.currentDesignation || "",
      c.experience || "",
      c.status,
      c.currentCtc || "",
      c.negotiatedCtc || "",
      c.selectedSite || "",
      c.selectedPosition || "",
      (c.remarks || "").replace(/"/g, "'"),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `candidates_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredCandidates = candidates?.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.tokenNo?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.mobile.includes(searchTerm) ||
      (c.candidateRef && c.candidateRef.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.selectedSite && c.selectedSite.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WAITING': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'IN_INTERVIEW': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'SELECTED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'REJECTED': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'ON_HOLD': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    }
  };

  const secondsSince = lastImportTime
    ? Math.floor((Date.now() - lastImportTime.getTime()) / 1000)
    : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation("/")} className="px-2 -ml-2">
              &larr; Back
            </Button>
            <img src="/kp-logo.png" alt="KP Group" className="h-8 w-8 object-contain" />
            <h1 className="font-semibold text-lg">Candidate Roster</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={!filteredCandidates?.length}>
              <Download className="w-4 h-4" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowSettings(s => !s)}>
              <Settings className="w-4 h-4" /> Sheet
            </Button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-4">
          <div className="container mx-auto max-w-3xl flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-sm font-semibold text-blue-800">Google Sheet URL (auto-imports every 10s)</Label>
              <Input
                value={sheetUrlInput}
                onChange={e => setSheetUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="bg-white border-blue-200 text-sm"
              />
              <p className="text-xs text-blue-600">Sheet must be shared as "Anyone with the link → Viewer"</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveUrl} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4" /> Save &amp; Import
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSettings(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search name, token, mobile, site…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white w-full sm:w-52">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PRE_REGISTERED">Pre-Registered</SelectItem>
                <SelectItem value="WAITING">Waiting</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="IN_INTERVIEW">In Interview</SelectItem>
                <SelectItem value="SELECTED">Selected</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
                <SelectItem value="NO_SHOW">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-500 flex-shrink-0">
            {importStatus === "importing" && (
              <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                <Loader2 className="w-4 h-4 animate-spin" /> Importing…
              </span>
            )}
            {importStatus === "success" && (
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <CheckCircle2 className="w-4 h-4" /> {importMessage}
              </span>
            )}
            {importStatus === "error" && (
              <span className="flex items-center gap-1.5 text-destructive font-medium">
                <AlertCircle className="w-4 h-4" /> {importMessage}
              </span>
            )}
            {importStatus === "idle" && savedSheetUrl && (
              <span className="flex items-center gap-1.5 text-zinc-400">
                <RefreshCw className="w-3.5 h-3.5" />
                {lastImportTime ? `Updated ${secondsSince}s ago` : "Auto-import active"}
              </span>
            )}
            {!savedSheetUrl && (
              <Button size="sm" variant="outline" onClick={() => setShowSettings(true)} className="gap-1.5 text-zinc-500">
                <Settings className="w-3.5 h-3.5" /> Configure Sheet URL
              </Button>
            )}
            <span className="text-zinc-400 font-medium">{filteredCandidates?.length ?? 0} shown</span>
          </div>
        </div>

        <Card className="bg-white border-zinc-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-zinc-50 border-b border-zinc-200">
                  <TableRow>
                    <TableHead className="w-24 font-semibold">Ref / Token</TableHead>
                    <TableHead className="font-semibold">Candidate</TableHead>
                    <TableHead className="font-semibold">Current Role</TableHead>
                    <TableHead className="font-semibold">Contact</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Site / Position</TableHead>
                    <TableHead className="font-semibold min-w-[200px]">Comments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-zinc-500">
                        No candidates found matching your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCandidates?.map((candidate) => (
                      <TableRow key={candidate.id} className="hover:bg-zinc-50/50 transition-colors">
                        <TableCell>
                          <div className="font-mono text-xs text-zinc-400 font-medium">{candidate.candidateRef || '—'}</div>
                          <div className="font-mono font-bold text-primary text-sm">{candidate.tokenNo || '—'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-zinc-900">{candidate.name}</div>
                          <div className="text-xs text-zinc-400">{candidate.location || ''}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-zinc-700">{candidate.currentDesignation || candidate.position}</div>
                          <div className="text-xs text-zinc-400">{candidate.currentCompany || ''}</div>
                          {candidate.experience && <div className="text-xs text-zinc-400">{candidate.experience} exp</div>}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-zinc-900">{candidate.mobile}</div>
                          <div className="text-xs text-zinc-500 truncate max-w-[140px]">{candidate.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`font-semibold tracking-wide border px-2 py-0.5 text-xs ${getStatusColor(candidate.status)}`}>
                            {candidate.status.replace(/_/g, ' ')}
                          </Badge>
                          {(candidate.currentCtc || candidate.negotiatedCtc) && (
                            <div className="mt-1.5 space-y-0.5">
                              {candidate.currentCtc && (
                                <div className="text-xs text-zinc-500">CTC: <span className="font-medium text-zinc-700">{candidate.currentCtc}</span></div>
                              )}
                              {candidate.negotiatedCtc && (
                                <div className="text-xs text-zinc-500">Neg: <span className="font-medium text-emerald-700">{candidate.negotiatedCtc}</span></div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {(candidate.selectedSite || candidate.selectedPosition) ? (
                            <div>
                              {candidate.selectedSite && (
                                <div className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5 inline-block mb-1">
                                  {candidate.selectedSite}
                                </div>
                              )}
                              {candidate.selectedPosition && (
                                <div className="text-xs text-zinc-700 font-medium">{candidate.selectedPosition}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-300 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {candidate.remarks ? (
                            <p className="text-xs text-zinc-600 leading-relaxed max-w-[220px] line-clamp-3" title={candidate.remarks}>
                              {candidate.remarks}
                            </p>
                          ) : (
                            <span className="text-zinc-300 text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
