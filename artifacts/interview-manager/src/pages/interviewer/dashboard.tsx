import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useListTables,
  useListTokens,
  useStartSession,
  useEndSession,
  useListSitePositions,
  useListSessions,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, PlayCircle, StopCircle, CheckCircle, XCircle, PauseCircle, Clock, Users, MapPin, Briefcase, DollarSign } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function CountdownTimer({ startTime }: { startTime: string }) {
  const [timeLeft, setTimeLeft] = useState(20 * 60);

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const elapsedSeconds = Math.floor((now - start) / 1000);
      const remaining = Math.max(20 * 60 - elapsedSeconds, 0);
      setTimeLeft(remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isWarning = timeLeft <= 120;

  return (
    <div className={`font-mono text-4xl sm:text-5xl font-bold tracking-tighter flex items-center justify-center p-4 sm:p-6 rounded-xl ${isWarning ? 'bg-destructive/10 text-destructive animate-pulse' : 'bg-primary/10 text-primary'}`}>
      <Clock className="w-6 h-6 sm:w-8 sm:h-8 mr-3 sm:mr-4 opacity-50" />
      {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
    </div>
  );
}

export default function InterviewerDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [showSelectionForm, setShowSelectionForm] = useState(false);
  const [selSite, setSelSite] = useState("");
  const [selPosition, setSelPosition] = useState("");
  const [currentCtc, setCurrentCtc] = useState("");
  const [negotiatedCtc, setNegotiatedCtc] = useState("");
  const [remarksError, setRemarksError] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) setLocation("/login");
  }, [setLocation]);

  const { data: tables, isLoading: isLoadingTables } = useListTables({
    query: { refetchInterval: 5000 }
  });

  const selectedTable = tables?.find(t => t.id.toString() === selectedTableId);

  const { data: tokens } = useListTokens(undefined, {
    query: {
      enabled: !!selectedTableId,
      refetchInterval: 5000,
    } as any
  });

  const { data: sitePositions } = useListSitePositions({
    query: { refetchInterval: 30000 }
  });

  const { data: selectedSessions } = useListSessions(
    { result: 'SELECTED' },
    { query: { refetchInterval: 15000 } }
  );

  const activeToken = tokens?.find(t =>
    t.assignedTableId?.toString() === selectedTableId &&
    (t.status === 'ASSIGNED' || t.status === 'IN_INTERVIEW')
  );

  const startMutation = useStartSession();
  const endMutation = useEndSession();

  const uniqueSites = [...new Set((sitePositions || []).map(sp => sp.site))].sort();
  const positionsForSite = (sitePositions || []).filter(sp => sp.site === selSite);

  const getSelectedCount = () => {
    if (!selSite || !selPosition) return 0;
    return (selectedSessions || []).filter(s =>
      s.selectedSite === selSite && s.selectedPosition === selPosition
    ).length;
  };

  const getOpenings = () => {
    const sp = (sitePositions || []).find(p => p.site === selSite && p.position === selPosition);
    return sp?.openings ?? 0;
  };

  const handleStart = () => {
    if (!selectedTable?.currentSessionId) return;
    startMutation.mutate({ id: selectedTable.currentSessionId }, {
      onSuccess: () => queryClient.invalidateQueries()
    });
  };

  const handleRejectOrHold = (result: 'REJECTED' | 'ON_HOLD') => {
    if (!remarks.trim()) {
      setRemarksError(true);
      return;
    }
    setRemarksError(false);
    if (!selectedTable?.currentSessionId) return;
    endMutation.mutate({
      id: selectedTable.currentSessionId,
      data: { result, remarks }
    }, {
      onSuccess: () => {
        setRemarks("");
        setRemarksError(false);
        queryClient.invalidateQueries();
      }
    });
  };

  const handleSelectClick = () => {
    if (!remarks.trim()) {
      setRemarksError(true);
      return;
    }
    setRemarksError(false);
    setShowSelectionForm(true);
  };

  const handleConfirmSelection = () => {
    if (!selectedTable?.currentSessionId) return;
    endMutation.mutate({
      id: selectedTable.currentSessionId,
      data: {
        result: 'SELECTED',
        remarks,
        selectedSite: selSite || undefined,
        selectedPosition: selPosition || undefined,
        currentCtc: currentCtc || undefined,
        negotiatedCtc: negotiatedCtc || undefined,
      }
    }, {
      onSuccess: () => {
        setRemarks("");
        setSelSite("");
        setSelPosition("");
        setCurrentCtc("");
        setNegotiatedCtc("");
        setShowSelectionForm(false);
        setRemarksError(false);
        queryClient.invalidateQueries();
      }
    });
  };

  if (isLoadingTables) return (
    <div className="p-8 flex justify-center">
      <Loader2 className="animate-spin text-primary" />
    </div>
  );

  const selectedCount = getSelectedCount();
  const openings = getOpenings();

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="bg-zinc-950 text-white border-b border-zinc-800">
        <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/kp-logo.png" alt="KP Group" className="h-8 w-8 object-contain bg-white rounded p-0.5 flex-shrink-0" />
            <h1 className="font-semibold tracking-wide">KP Group of Companies</h1>
          </div>
          <div className="w-full sm:w-64">
            <Select value={selectedTableId} onValueChange={(v) => { setSelectedTableId(v); setShowSelectionForm(false); }}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white h-10">
                <SelectValue placeholder="Select your table" />
              </SelectTrigger>
              <SelectContent>
                {tables?.map(t => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    Table {t.tableNo} — {t.department || 'General'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-4xl">
        {!selectedTableId ? (
          <div className="text-center py-16 sm:py-24 text-zinc-500 flex flex-col items-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
              <Users className="w-9 h-9 sm:w-10 sm:h-10 text-zinc-300" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-2 text-zinc-900">Select a table to begin</h2>
            <p className="text-sm sm:text-base">Please select your assigned table from the dropdown above.</p>
          </div>
        ) : !activeToken ? (
          <div className="text-center py-16 sm:py-24 text-zinc-500 bg-white rounded-2xl border shadow-sm flex flex-col items-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-zinc-50 rounded-full flex items-center justify-center mb-6 border-2 border-dashed border-zinc-200">
              <Clock className="w-9 h-9 sm:w-10 sm:h-10 text-zinc-300" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-2 text-zinc-900">Waiting for candidate</h2>
            <p className="text-sm sm:text-base">No candidate currently assigned to Table {selectedTable?.tableNo}.</p>
            <p className="text-xs text-zinc-400 mt-2">Auto-refreshing every 5 seconds…</p>
          </div>
        ) : (
          <Card className="border-0 shadow-xl overflow-hidden rounded-2xl">
            <div className="bg-zinc-900 p-5 sm:p-8 flex flex-col sm:flex-row sm:justify-between sm:items-center text-white gap-4">
              <div>
                <Badge variant="outline" className="bg-white/10 text-white border-white/20 mb-3 px-3 py-1 font-medium tracking-wide">
                  {activeToken.status.replace('_', ' ')}
                </Badge>
                <h2 className="text-2xl sm:text-4xl font-bold tracking-tight mb-1 sm:mb-2">{activeToken.candidateName}</h2>
                <p className="text-zinc-400 font-medium text-base sm:text-lg">{activeToken.position}</p>
              </div>
              <div className="sm:text-right">
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Token</div>
                <div className="text-5xl sm:text-6xl font-bold text-primary font-mono tracking-tighter">{activeToken.tokenNo}</div>
              </div>
            </div>

            <CardContent className="p-5 sm:p-8 space-y-6 sm:space-y-8">
              {activeToken.status === 'ASSIGNED' && (
                <div className="flex justify-center py-6 sm:py-8">
                  <Button
                    onClick={handleStart}
                    disabled={startMutation.isPending}
                    className="h-16 sm:h-20 px-8 sm:px-12 text-xl sm:text-2xl font-bold rounded-2xl shadow-lg hover:scale-105 transition-transform w-full sm:w-auto"
                  >
                    {startMutation.isPending
                      ? <Loader2 className="w-7 h-7 animate-spin" />
                      : <><PlayCircle className="w-7 h-7 mr-3" /> START INTERVIEW</>
                    }
                  </Button>
                </div>
              )}

              {activeToken.status === 'IN_INTERVIEW' && selectedTable?.sessionStartTime && (
                <div className="space-y-6 sm:space-y-8 animate-in fade-in zoom-in-95 duration-300">
                  <CountdownTimer startTime={selectedTable.sessionStartTime} />

                  <div className="space-y-3 sm:space-y-4">
                    <Label className={`text-base sm:text-lg font-semibold ${remarksError ? 'text-destructive' : 'text-zinc-900'}`}>
                      Interviewer Remarks <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      value={remarks}
                      onChange={(e) => { setRemarks(e.target.value); if (e.target.value.trim()) setRemarksError(false); }}
                      placeholder="Add your notes about the candidate here... (required)"
                      className={`min-h-[120px] sm:min-h-[160px] text-sm sm:text-base p-3 sm:p-4 resize-none bg-zinc-50 focus-visible:ring-primary ${remarksError ? 'border-destructive bg-destructive/5' : 'border-zinc-200'}`}
                    />
                    {remarksError && (
                      <p className="text-destructive text-sm font-medium">Please add remarks before ending the interview.</p>
                    )}
                  </div>

                  {!showSelectionForm ? (
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={() => handleRejectOrHold('REJECTED')}
                        disabled={endMutation.isPending}
                        className="h-12 sm:h-16 text-sm sm:text-lg font-bold border-destructive text-destructive hover:bg-destructive hover:text-white px-2 sm:px-4"
                      >
                        <XCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">REJECT</span>
                        <span className="sm:hidden">Reject</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleRejectOrHold('ON_HOLD')}
                        disabled={endMutation.isPending}
                        className="h-12 sm:h-16 text-sm sm:text-lg font-bold border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white px-2 sm:px-4"
                      >
                        <PauseCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">ON HOLD</span>
                        <span className="sm:hidden">Hold</span>
                      </Button>
                      <Button
                        onClick={handleSelectClick}
                        disabled={endMutation.isPending}
                        className="h-12 sm:h-16 text-sm sm:text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2 sm:px-4"
                      >
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">SELECT</span>
                        <span className="sm:hidden">Select</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="border-t pt-6 space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <h3 className="font-bold text-emerald-800 text-lg mb-1">Selection Details</h3>
                        <p className="text-emerald-700 text-sm">Please fill in the placement details for this candidate.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> Site / Location</Label>
                          <Select value={selSite} onValueChange={(v) => { setSelSite(v); setSelPosition(""); }}>
                            <SelectTrigger className="bg-zinc-50">
                              <SelectValue placeholder="Select site..." />
                            </SelectTrigger>
                            <SelectContent>
                              {uniqueSites.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4" /> Position Offered</Label>
                          <Select value={selPosition} onValueChange={setSelPosition} disabled={!selSite}>
                            <SelectTrigger className="bg-zinc-50">
                              <SelectValue placeholder={selSite ? "Select position..." : "Select site first"} />
                            </SelectTrigger>
                            <SelectContent>
                              {positionsForSite.map(p => (
                                <SelectItem key={p.id} value={p.position}>{p.position}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4" /> Current CTC</Label>
                          <Input
                            value={currentCtc}
                            onChange={(e) => setCurrentCtc(e.target.value)}
                            placeholder="e.g. ₹4.5 LPA"
                            className="bg-zinc-50"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4" /> Negotiated CTC</Label>
                          <Input
                            value={negotiatedCtc}
                            onChange={(e) => setNegotiatedCtc(e.target.value)}
                            placeholder="e.g. ₹6 LPA"
                            className="bg-zinc-50"
                          />
                        </div>
                      </div>

                      {selSite && selPosition && (
                        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex items-center justify-between">
                          <span className="text-sm text-zinc-600 font-medium">
                            {selSite} — {selPosition}
                          </span>
                          <div className="text-right">
                            <span className={`text-lg font-bold ${selectedCount >= openings ? 'text-destructive' : 'text-emerald-600'}`}>
                              {selectedCount}
                            </span>
                            <span className="text-zinc-400 text-sm"> / {openings} filled</span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setShowSelectionForm(false)}
                          className="flex-1 h-12 font-semibold"
                        >
                          Back
                        </Button>
                        <Button
                          onClick={handleConfirmSelection}
                          disabled={endMutation.isPending}
                          className="flex-1 h-12 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {endMutation.isPending
                            ? <Loader2 className="w-5 h-5 animate-spin" />
                            : <><CheckCircle className="w-5 h-5 mr-2" /> CONFIRM SELECTION</>
                          }
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
