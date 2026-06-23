import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useListTables, 
  useListTokens, 
  useStartSession, 
  useEndSession 
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, PlayCircle, StopCircle, CheckCircle, XCircle, PauseCircle, Clock, Users } from "lucide-react";
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

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) setLocation("/login");
  }, [setLocation]);

  const { data: tables, isLoading: isLoadingTables } = useListTables({
    query: { refetchInterval: 5000 }
  });
  
  const selectedTable = tables?.find(t => t.id.toString() === selectedTableId);
  
  const { data: tokens } = useListTokens({
    query: {
      enabled: !!selectedTableId,
      refetchInterval: 5000,
    }
  });

  const activeToken = tokens?.find(t => 
    t.assignedTableId?.toString() === selectedTableId && 
    (t.status === 'ASSIGNED' || t.status === 'IN_INTERVIEW')
  );

  const startMutation = useStartSession();
  const endMutation = useEndSession();

  const handleStart = () => {
    if (!selectedTable?.currentSessionId) return;
    startMutation.mutate({ id: selectedTable.currentSessionId }, {
      onSuccess: () => queryClient.invalidateQueries()
    });
  };

  const handleEnd = (result: 'SELECTED' | 'REJECTED' | 'ON_HOLD') => {
    if (!selectedTable?.currentSessionId) return;
    endMutation.mutate({ 
      id: selectedTable.currentSessionId,
      data: { result, remarks }
    }, {
      onSuccess: () => {
        setRemarks("");
        queryClient.invalidateQueries();
      }
    });
  };

  if (isLoadingTables) return (
    <div className="p-8 flex justify-center">
      <Loader2 className="animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="bg-zinc-950 text-white border-b border-zinc-800">
        <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded flex items-center justify-center font-bold text-white flex-shrink-0">W</div>
            <h1 className="font-semibold tracking-wide">Interviewer Console</h1>
          </div>
          <div className="w-full sm:w-64">
            <Select value={selectedTableId} onValueChange={setSelectedTableId}>
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
                    <Label className="text-base sm:text-lg font-semibold text-zinc-900">Interviewer Remarks</Label>
                    <Textarea 
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add your notes about the candidate here..."
                      className="min-h-[120px] sm:min-h-[160px] text-sm sm:text-base p-3 sm:p-4 resize-none bg-zinc-50 border-zinc-200 focus-visible:ring-primary"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => handleEnd('REJECTED')}
                      disabled={endMutation.isPending}
                      className="h-12 sm:h-16 text-sm sm:text-lg font-bold border-destructive text-destructive hover:bg-destructive hover:text-white px-2 sm:px-4"
                    >
                      <XCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">REJECT</span>
                      <span className="sm:hidden">Reject</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleEnd('ON_HOLD')}
                      disabled={endMutation.isPending}
                      className="h-12 sm:h-16 text-sm sm:text-lg font-bold border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white px-2 sm:px-4"
                    >
                      <PauseCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">ON HOLD</span>
                      <span className="sm:hidden">Hold</span>
                    </Button>
                    <Button 
                      onClick={() => handleEnd('SELECTED')}
                      disabled={endMutation.isPending}
                      className="h-12 sm:h-16 text-sm sm:text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2 sm:px-4"
                    >
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">SELECT</span>
                      <span className="sm:hidden">Select</span>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
