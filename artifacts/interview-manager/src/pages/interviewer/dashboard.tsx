import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useListTables, 
  useListTokens, 
  useStartSession, 
  useEndSession 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, PlayCircle, StopCircle, CheckCircle, XCircle, PauseCircle, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function CountdownTimer({ startTime }: { startTime: string }) {
  const [timeLeft, setTimeLeft] = useState(20 * 60); // 20 mins in seconds
  
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
  
  const isWarning = timeLeft <= 120; // 2 mins remaining
  
  return (
    <div className={`font-mono text-5xl font-bold tracking-tighter flex items-center justify-center p-6 rounded-xl ${isWarning ? 'bg-destructive/10 text-destructive animate-pulse' : 'bg-primary/10 text-primary'}`}>
      <Clock className="w-8 h-8 mr-4 opacity-50" />
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

  const { data: tables, isLoading: isLoadingTables } = useListTables();
  
  const selectedTable = tables?.find(t => t.id.toString() === selectedTableId);
  
  // We look for ASSIGNED tokens for this table. Or IN_INTERVIEW if one is active.
  const { data: tokens, isLoading: isLoadingTokens } = useListTokens({
    query: {
      enabled: !!selectedTableId,
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
      onSuccess: () => {
        queryClient.invalidateQueries();
      }
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

  if (isLoadingTables) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="bg-zinc-950 text-white border-b border-zinc-800">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary rounded flex items-center justify-center font-bold text-white">W</div>
            <h1 className="font-semibold tracking-wide">Interviewer Console</h1>
          </div>
          <div className="w-64">
            <Select value={selectedTableId} onValueChange={setSelectedTableId}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white h-10">
                <SelectValue placeholder="Select your table" />
              </SelectTrigger>
              <SelectContent>
                {tables?.map(t => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    Table {t.tableNo} - {t.department || 'General'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {!selectedTableId ? (
          <div className="text-center py-24 text-zinc-500 flex flex-col items-center">
            <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
              <Users className="w-10 h-10 text-zinc-300" />
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-zinc-900">Select a table to begin</h2>
            <p>Please select your assigned table from the dropdown above.</p>
          </div>
        ) : !activeToken ? (
          <div className="text-center py-24 text-zinc-500 bg-white rounded-2xl border shadow-sm flex flex-col items-center">
            <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mb-6 border-2 border-dashed border-zinc-200">
              <Clock className="w-10 h-10 text-zinc-300" />
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-zinc-900">Waiting for candidate</h2>
            <p>No candidate currently assigned to Table {selectedTable?.tableNo}.</p>
          </div>
        ) : (
          <Card className="border-0 shadow-xl overflow-hidden rounded-2xl">
            <div className="bg-zinc-900 p-8 flex justify-between items-center text-white">
              <div>
                <Badge variant="outline" className="bg-white/10 text-white border-white/20 mb-3 px-3 py-1 font-medium tracking-wide">
                  {activeToken.status.replace('_', ' ')}
                </Badge>
                <h2 className="text-4xl font-bold tracking-tight mb-2">{activeToken.candidateName}</h2>
                <p className="text-zinc-400 font-medium text-lg">{activeToken.position}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-1">Token Number</div>
                <div className="text-6xl font-bold text-primary font-mono tracking-tighter">{activeToken.tokenNo}</div>
              </div>
            </div>

            <CardContent className="p-8 space-y-8">
              {activeToken.status === 'ASSIGNED' && (
                <div className="flex justify-center py-8">
                  <Button 
                    onClick={handleStart}
                    disabled={startMutation.isPending}
                    className="h-20 px-12 text-2xl font-bold rounded-2xl shadow-lg hover:scale-105 transition-transform"
                  >
                    {startMutation.isPending ? <Loader2 className="w-8 h-8 animate-spin" /> : <><PlayCircle className="w-8 h-8 mr-3" /> START INTERVIEW</>}
                  </Button>
                </div>
              )}

              {activeToken.status === 'IN_INTERVIEW' && selectedTable?.sessionStartTime && (
                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                  <CountdownTimer startTime={selectedTable.sessionStartTime} />
                  
                  <div className="space-y-4">
                    <Label className="text-lg font-semibold text-zinc-900">Interviewer Remarks</Label>
                    <Textarea 
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add your notes about the candidate here..."
                      className="min-h-[160px] text-base p-4 resize-none bg-zinc-50 border-zinc-200 focus-visible:ring-primary"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => handleEnd('REJECTED')}
                      disabled={endMutation.isPending}
                      className="h-16 text-lg font-bold border-destructive text-destructive hover:bg-destructive hover:text-white"
                    >
                      <XCircle className="w-5 h-5 mr-2" /> REJECT
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleEnd('ON_HOLD')}
                      disabled={endMutation.isPending}
                      className="h-16 text-lg font-bold border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white"
                    >
                      <PauseCircle className="w-5 h-5 mr-2" /> ON HOLD
                    </Button>
                    <Button 
                      onClick={() => handleEnd('SELECTED')}
                      disabled={endMutation.isPending}
                      className="h-16 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" /> SELECT
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

// Ensure lucide icon Users is imported above
import { Users } from "lucide-react";
