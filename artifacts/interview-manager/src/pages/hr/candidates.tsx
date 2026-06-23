import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useListCandidates, useImportCandidates } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Upload, X, CheckCircle2, AlertCircle, Sheet, FileSpreadsheet } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

type ParsedRow = {
  name: string;
  mobile: string;
  email: string;
  position: string;
  experience?: string;
  currentCompany?: string;
  currentDesignation?: string;
  location?: string;
};

type ImportTab = "excel" | "sheets";

function PreviewTable({ rows }: { rows: ParsedRow[] }) {
  const invalid = rows.filter(r => !r.name || !r.mobile || !r.email || !r.position);
  return (
    <>
      <div className="flex items-center justify-between text-sm">
        <p className="font-semibold text-zinc-700">
          {rows.length} rows found
          {invalid.length > 0 && (
            <span className="text-amber-600 ml-2">({invalid.length} missing required fields — will be skipped)</span>
          )}
        </p>
        <p className="text-zinc-400">Required: Full Name, Email, Phone Number, Current Designation</p>
      </div>
      <div className="rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-auto max-h-60">
          <Table>
            <TableHeader className="bg-zinc-50">
              <TableRow>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Phone</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Designation</TableHead>
                <TableHead className="font-semibold">Company</TableHead>
                <TableHead className="font-semibold">Experience</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 50).map((row, i) => {
                const bad = !row.name || !row.mobile || !row.email || !row.position;
                return (
                  <TableRow key={i} className={bad ? "bg-amber-50" : ""}>
                    <TableCell className="font-medium">{row.name || <span className="text-destructive text-xs">missing</span>}</TableCell>
                    <TableCell>{row.mobile || <span className="text-destructive text-xs">missing</span>}</TableCell>
                    <TableCell className="text-xs text-zinc-500 max-w-[120px] truncate">{row.email || <span className="text-destructive text-xs">missing</span>}</TableCell>
                    <TableCell>{row.position || <span className="text-destructive text-xs">missing</span>}</TableCell>
                    <TableCell className="text-zinc-500 text-sm">{row.currentCompany || '—'}</TableCell>
                    <TableCell className="text-zinc-500 text-sm">{row.experience || '—'}</TableCell>
                    <TableCell>
                      {bad
                        ? <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-xs">Skip</Badge>
                        : <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-xs">OK</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length > 50 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-zinc-400 text-sm py-3">
                    … and {rows.length - 50} more rows
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<ImportTab>("excel");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [fetchingSheet, setFetchingSheet] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number; errors: string[] } | null>(null);

  const importMutation = useImportCandidates();

  const resetRows = () => { setRows([]); setParseError(null); setResult(null); };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resetRows();
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const normalize = (row: Record<string, unknown>, keys: string[]): string => {
          for (const k of keys) {
            const found = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase());
            if (found && row[found]) return String(row[found]).trim();
          }
          return "";
        };
        const parsed: ParsedRow[] = json.map((row) => ({
          name: normalize(row, ["name", "full name", "candidate name", "candidate"]),
          mobile: normalize(row, ["mobile", "phone", "contact", "mobile number", "phone number", "mobile no", "phone no"]),
          email: normalize(row, ["email", "email address", "mail", "e-mail"]),
          position: normalize(row, ["position", "role", "job title", "applied for", "post", "current designation"]),
          experience: normalize(row, ["experience", "exp", "years", "total experience", "years of experience"]) || undefined,
          currentCompany: normalize(row, ["current company", "company", "organisation", "organization", "employer"]) || undefined,
          currentDesignation: normalize(row, ["current designation", "designation", "current role", "current title"]) || undefined,
          location: normalize(row, ["location", "city", "place", "current location"]) || undefined,
        })).filter(r => r.name || r.mobile || r.email);
        if (parsed.length === 0) { setParseError("No rows found. Make sure your sheet has columns: Name, Mobile, Email, Position."); return; }
        setRows(parsed);
      } catch {
        setParseError("Could not parse file. Please use a valid .xlsx or .xls file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFetchSheet = async () => {
    if (!sheetUrl.trim()) return;
    resetRows();
    setFetchingSheet(true);
    try {
      const resp = await fetch(`/api/candidates/fetch-sheet?url=${encodeURIComponent(sheetUrl)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      const data = await resp.json();
      if (!resp.ok) { setParseError(data.error || "Failed to fetch sheet"); return; }
      if (!data.rows || data.rows.length === 0) { setParseError("No rows found. Check that the sheet has the required columns and is shared correctly."); return; }
      setRows(data.rows);
    } catch {
      setParseError("Network error. Could not reach the Google Sheet.");
    } finally {
      setFetchingSheet(false);
    }
  };

  const handleImport = () => {
    importMutation.mutate({ data: { candidates: rows } }, {
      onSuccess: (data) => { setResult(data); queryClient.invalidateQueries(); }
    });
  };

  const validRows = rows.filter(r => r.name && r.mobile && r.email && r.position);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-zinc-900">Import Candidates</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-9 w-9">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {!result && (
          <div className="px-6 pt-4 flex gap-2">
            <Button
              variant={tab === "excel" ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => { setTab("excel"); resetRows(); setFileName(""); }}
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel / CSV
            </Button>
            <Button
              variant={tab === "sheets" ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => { setTab("sheets"); resetRows(); setSheetUrl(""); }}
            >
              <Sheet className="w-4 h-4" /> Google Sheets
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6 space-y-5">
          {!result ? (
            <>
              {tab === "excel" && (
                <div
                  className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
                  <Upload className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
                  {fileName ? (
                    <p className="font-medium text-zinc-700">{fileName}</p>
                  ) : (
                    <>
                      <p className="font-medium text-zinc-700">Click to upload Excel or CSV file</p>
                      <p className="text-sm text-zinc-400 mt-1">Supports .xlsx, .xls, .csv</p>
                    </>
                  )}
                </div>
              )}

              {tab === "sheets" && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-2">
                    <p className="font-semibold">How to share your Google Sheet:</p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-700">
                      <li>Open your Google Sheet</li>
                      <li>Click <strong>Share</strong> (top right)</li>
                      <li>Under "General access", choose <strong>Anyone with the link → Viewer</strong></li>
                      <li>Click <strong>Copy link</strong> and paste it below</li>
                    </ol>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="flex-1 bg-zinc-50"
                    />
                    <Button onClick={handleFetchSheet} disabled={fetchingSheet || !sheetUrl.trim()} className="gap-2 flex-shrink-0">
                      {fetchingSheet ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching…</> : "Load Sheet"}
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Column headers should include: <strong>Name, Mobile, Email, Position</strong> (optional: Experience, Location)
                  </p>
                </div>
              )}

              {parseError && (
                <div className="flex items-start gap-3 bg-destructive/10 text-destructive rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium">{parseError}</p>
                </div>
              )}

              {rows.length > 0 && <PreviewTable rows={rows} />}
            </>
          ) : (
            <div className="py-8 text-center space-y-6">
              <div className="mx-auto h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-zinc-900 mb-2">Import Complete</h3>
                <p className="text-zinc-500">Out of {result.total} rows processed:</p>
              </div>
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-emerald-600">{result.imported}</div>
                  <div className="text-sm text-zinc-500 font-medium mt-1">Imported</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-zinc-400">{result.skipped}</div>
                  <div className="text-sm text-zinc-500 font-medium mt-1">Skipped</div>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-zinc-50 rounded-xl p-4 text-left">
                  <p className="text-sm font-semibold text-zinc-600 mb-2">Notes:</p>
                  <ul className="text-xs text-zinc-500 space-y-1">
                    {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    {result.errors.length > 5 && <li>…and {result.errors.length - 5} more</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>{result ? "Close" : "Cancel"}</Button>
          {!result && rows.length > 0 && (
            <Button
              onClick={handleImport}
              disabled={importMutation.isPending || validRows.length === 0}
              className="gap-2"
            >
              {importMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                : <><Upload className="w-4 h-4" /> Import {validRows.length} Candidates</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Candidates() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showImport, setShowImport] = useState(false);

  const { data: candidates, isLoading } = useListCandidates({
    query: { refetchInterval: 10000 }
  });

  const filteredCandidates = candidates?.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.tokenNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobile.includes(searchTerm) ||
      (c.candidateRef && c.candidateRef.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WAITING': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'IN_INTERVIEW': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'COMPLETED': return 'bg-zinc-100 text-zinc-800 border-zinc-200';
      case 'SELECTED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'REJECTED': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}

      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation("/")} className="px-2 -ml-2">
              &larr; Back
            </Button>
            <img src="/kp-logo.png" alt="KP Group" className="h-8 w-8 object-contain" />
            <h1 className="font-semibold text-lg">Candidate Roster</h1>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4" /> Import
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search by name, token, ref, or mobile…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
          <div className="w-full md:w-64">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="WAITING">Waiting</SelectItem>
                <SelectItem value="IN_INTERVIEW">In Interview</SelectItem>
                <SelectItem value="SELECTED">Selected</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="NO_SHOW">No Show</SelectItem>
              </SelectContent>
            </Select>
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
                    <TableHead className="w-24 font-semibold">Ref ID</TableHead>
                    <TableHead className="w-20 font-semibold">Token</TableHead>
                    <TableHead className="font-semibold">Candidate</TableHead>
                    <TableHead className="font-semibold">Current Role</TableHead>
                    <TableHead className="font-semibold">Contact</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-zinc-500">
                        No candidates found matching your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCandidates?.map((candidate) => (
                      <TableRow key={candidate.id} className="hover:bg-zinc-50/50 transition-colors">
                        <TableCell className="font-mono text-xs text-zinc-500 font-medium">
                          {candidate.candidateRef || '—'}
                        </TableCell>
                        <TableCell className="font-mono font-medium text-primary">
                          {candidate.tokenNo || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-zinc-900">{candidate.name}</div>
                          <div className="text-xs text-zinc-400">{candidate.location || ''}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-zinc-700">{candidate.currentDesignation || candidate.position}</div>
                          <div className="text-xs text-zinc-400">{candidate.currentCompany || ''}</div>
                          <div className="text-xs text-zinc-400">{candidate.experience ? `${candidate.experience} exp` : ''}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-zinc-900">{candidate.mobile}</div>
                          <div className="text-xs text-zinc-500 truncate max-w-[150px]">{candidate.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`font-semibold tracking-wide border px-2 py-0.5 ${getStatusColor(candidate.status)}`}>
                            {candidate.status.replace('_', ' ')}
                          </Badge>
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
