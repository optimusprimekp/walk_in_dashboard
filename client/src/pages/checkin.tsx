import { useState, useEffect } from "react";
import { useLookupCandidate, useCheckinCandidate, useGetRoutingOptions } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, CheckCircle2, Camera, ChevronRight } from "lucide-react";

type Step = 'HOME' | 'PRE_REGISTERED_LOOKUP' | 'DEPT_POSITION' | 'CONFIRMATION' | 'ALREADY';

const IN_QUEUE_STATUSES = ["WAITING", "ASSIGNED", "IN_INTERVIEW"];
const DONE_STATUSES = ["COMPLETED", "SELECTED", "REJECTED", "ON_HOLD", "NO_SHOW"];

const FIXED_DEPTS = ["Solar O&M", "Wind BoP O&M", "R&D"];

export default function Checkin() {
  const [step, setStep] = useState<Step>('HOME');
  const [identifier, setIdentifier] = useState("");
  const [candidateId, setCandidateId] = useState<number | null>(null);
  const [candidateName, setCandidateName] = useState("");

  const [selectedDept, setSelectedDept] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");

  const [tokenResult, setTokenResult] = useState<{ tokenNo: string; name: string; position: string; department?: string } | null>(null);
  const [alreadyInfo, setAlreadyInfo] = useState<{ title: string; detail: string; tokenNo?: string | null } | null>(null);
  const [countdown, setCountdown] = useState(30);

  const lookupMutation = useLookupCandidate();
  const checkinMutation = useCheckinCandidate();
  const { data: routingOptions, isLoading: routingLoading } = useGetRoutingOptions();

  const resetForm = () => {
    setIdentifier("");
    setCandidateId(null);
    setCandidateName("");
    setSelectedDept("");
    setSelectedPosition("");
    setTokenResult(null);
    setAlreadyInfo(null);
    setCountdown(30);
    setStep('HOME');
  };

  useEffect(() => {
    if (step !== 'CONFIRMATION') return;
    setCountdown(30);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          resetForm();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  // Reset position when dept changes
  useEffect(() => {
    setSelectedPosition("");
  }, [selectedDept]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) return;

    try {
      const isEmail = identifier.includes('@');
      const candidate = await lookupMutation.mutateAsync({
        data: {
          mobile: !isEmail ? identifier : undefined,
          email: isEmail ? identifier : undefined,
        },
      });
      // Already finished an interview — block re-check-in.
      if (DONE_STATUSES.includes(candidate.status)) {
        setAlreadyInfo({
          title: "Interview already taken",
          detail: "Our records show your interview is already complete. Please contact the HR desk if you need help.",
          tokenNo: candidate.tokenNo,
        });
        setStep('ALREADY');
        return;
      }
      // Already in the queue — don't issue a second token.
      if (IN_QUEUE_STATUSES.includes(candidate.status)) {
        setAlreadyInfo({
          title: "You're already checked in",
          detail: "Please take a seat and watch the TV screen for your token to be called.",
          tokenNo: candidate.tokenNo,
        });
        setStep('ALREADY');
        return;
      }
      setCandidateId(candidate.id);
      setCandidateName(candidate.name);
      setStep('DEPT_POSITION');
    } catch {
      window.location.href = "https://tally.so/r/WOMlqL";
    }
  };

  const handleCheckin = async () => {
    if (!candidateId || !selectedDept || !selectedPosition) return;
    try {
      const result = await checkinMutation.mutateAsync({
        id: candidateId,
        data: { department: selectedDept, position: selectedPosition },
      });
      setTokenResult({
        tokenNo: result.tokenNo,
        name: candidateName,
        position: selectedPosition,
        department: selectedDept,
      });
      setStep('CONFIRMATION');
    } catch {
      window.location.href = "https://tally.so/r/WOMlqL";
    }
  };

  const handleRegisterRedirect = () => {
    window.location.href = "https://tally.so/r/WOMlqL";
  };

  // Derive departments from routing options; fall back to fixed list
  const departments = (routingOptions?.departments?.length ?? 0) > 0
    ? routingOptions!.departments
    : FIXED_DEPTS;

  // Positions for selected department
  const availablePositions: string[] = selectedDept && routingOptions?.positionsByDept
    ? (routingOptions.positionsByDept[selectedDept] ?? [])
    : [];

  const canCheckin = selectedDept && selectedPosition;

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6 sm:mb-8">
          <div className="mx-auto mb-3 sm:mb-4 flex items-center justify-center">
            <img src="/kp-logo.png" alt="KP Group" className="h-14 w-14 sm:h-20 sm:w-20 object-contain drop-shadow-lg" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-zinc-900 mb-1">KP Group of Companies</h1>
          <p className="text-sm sm:text-xl text-zinc-500">Walk-In Interview Self Check-In</p>
        </div>

        <Card className="border-0 shadow-2xl shadow-zinc-200/50 overflow-hidden bg-white rounded-2xl sm:rounded-3xl">
          <CardContent className="p-5 sm:p-8 md:p-12">

            {/* ── STEP 1: HOME ── */}
            {step === 'HOME' && (
              <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-xl sm:text-2xl font-bold text-center mb-6 sm:mb-8">Are you pre-registered?</h2>
                <div className="grid grid-cols-2 gap-3 sm:gap-6">
                  <Button
                    onClick={() => setStep('PRE_REGISTERED_LOOKUP')}
                    className="h-24 sm:h-32 text-xl sm:text-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
                  >
                    YES
                  </Button>
                  <Button
                    onClick={handleRegisterRedirect}
                    variant="outline"
                    className="h-24 sm:h-32 text-xl sm:text-2xl font-bold border-2 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 shadow-sm transition-all"
                  >
                    NO
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 2: LOOKUP ── */}
            {step === 'PRE_REGISTERED_LOOKUP' && (
              <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center">
                  <Button variant="ghost" size="icon" onClick={() => setStep('HOME')} className="mr-2 sm:mr-4 rounded-full h-10 w-10 sm:h-12 sm:w-12 hover:bg-zinc-100 shrink-0">
                    <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                  </Button>
                  <h2 className="text-xl sm:text-2xl font-bold">Find your registration</h2>
                </div>

                <form onSubmit={handleLookup} className="space-y-6">
                  <div className="space-y-3 sm:space-y-4">
                    <Label htmlFor="identifier" className="text-base sm:text-lg">Mobile Number or Email</Label>
                    <Input
                      id="identifier"
                      type="text"
                      inputMode="email"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Enter mobile or email..."
                      className="h-14 sm:h-16 text-lg sm:text-xl px-4 sm:px-6 bg-zinc-50 border-zinc-200 rounded-xl"
                      required
                      autoFocus
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-xl"
                    disabled={lookupMutation.isPending}
                  >
                    {lookupMutation.isPending ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : "Find My Registration"}
                  </Button>
                </form>

                <p className="text-center text-sm text-zinc-400">
                  Not pre-registered?{" "}
                  <button
                    onClick={handleRegisterRedirect}
                    className="text-primary underline underline-offset-2 font-medium"
                  >
                    Register here
                  </button>
                </p>
              </div>
            )}

            {/* ── STEP 3: DEPARTMENT + POSITION ── */}
            {step === 'DEPT_POSITION' && (
              <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center">
                  <Button variant="ghost" size="icon" onClick={() => setStep('PRE_REGISTERED_LOOKUP')} className="mr-2 sm:mr-4 rounded-full h-10 w-10 sm:h-12 sm:w-12 hover:bg-zinc-100 shrink-0">
                    <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                  </Button>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold truncate">Welcome, {candidateName}!</h2>
                    <p className="text-sm sm:text-base text-zinc-500 mt-0.5">Please select your interview department and position</p>
                  </div>
                </div>

                {routingLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-6 sm:space-y-8">
                    {/* Department selection */}
                    <div className="space-y-3 sm:space-y-4">
                      <Label className="text-base sm:text-lg font-semibold">Department *</Label>
                      <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
                        {departments.map((dept) => (
                          <button
                            key={dept}
                            type="button"
                            onClick={() => setSelectedDept(dept)}
                            className={`w-full px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl border-2 text-left font-semibold text-base sm:text-lg transition-all ${
                              selectedDept === dept
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{dept}</span>
                              {selectedDept === dept && <ChevronRight className="h-5 w-5 text-primary" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Position selection — shown only after dept selected */}
                    {selectedDept && (
                      <div className="space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <Label className="text-base sm:text-lg font-semibold">Position *</Label>
                        {availablePositions.length === 0 ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-center">
                            No positions configured for this department yet.
                            <br />
                            <span className="text-sm">Please ask the HR desk for assistance.</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
                            {availablePositions.map((pos) => (
                              <button
                                key={pos}
                                type="button"
                                onClick={() => setSelectedPosition(pos)}
                                className={`w-full px-4 sm:px-6 py-3.5 sm:py-4 rounded-xl border-2 text-left font-medium text-base transition-all ${
                                  selectedPosition === pos
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{pos}</span>
                                  {selectedPosition === pos && <ChevronRight className="h-5 w-5 text-primary" />}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Summary + Confirm */}
                    {canCheckin && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-2">
                          <p className="text-sm text-zinc-500 font-medium uppercase tracking-wide">Your Selection</p>
                          <p className="text-lg font-semibold text-zinc-900">{selectedDept}</p>
                          <p className="text-base text-zinc-700">{selectedPosition}</p>
                        </div>
                        <Button
                          onClick={handleCheckin}
                          className="w-full h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-xl"
                          disabled={checkinMutation.isPending}
                        >
                          {checkinMutation.isPending ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : "Confirm & Get Token"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── ALREADY CHECKED IN / COMPLETED ── */}
            {step === 'ALREADY' && alreadyInfo && (
              <div className="py-4 sm:py-8 text-center space-y-5 sm:space-y-6 animate-in zoom-in-95 duration-500">
                <div className="mx-auto h-20 w-20 sm:h-24 sm:w-24 bg-amber-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-amber-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900">{alreadyInfo.title}</h2>
                  <p className="text-base text-zinc-500 max-w-md mx-auto">{alreadyInfo.detail}</p>
                </div>
                {alreadyInfo.tokenNo && (
                  <div className="bg-zinc-50 p-5 sm:p-6 rounded-2xl border-2 border-zinc-100 inline-block">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Your Token</p>
                    <div className="text-5xl sm:text-6xl font-bold text-primary tracking-tighter">{alreadyInfo.tokenNo}</div>
                  </div>
                )}
                <div>
                  <Button onClick={resetForm} className="h-12 px-8 text-base font-bold rounded-xl" variant="outline">
                    Done
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 4: CONFIRMATION ── */}
            {step === 'CONFIRMATION' && tokenResult && (
              <div className="py-4 sm:py-8 text-center space-y-6 sm:space-y-8 animate-in zoom-in-95 duration-500">
                <div className="mx-auto h-20 w-20 sm:h-24 sm:w-24 bg-emerald-100 rounded-full flex items-center justify-center mb-2 sm:mb-4">
                  <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-600" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900">Welcome, {tokenResult.name}</h2>
                  {tokenResult.department && (
                    <p className="text-base sm:text-lg text-zinc-500">{tokenResult.department}</p>
                  )}
                  <p className="text-lg sm:text-xl text-zinc-600 font-medium">{tokenResult.position}</p>
                </div>

                <div className="bg-zinc-50 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border-2 border-zinc-100 my-6 sm:my-8">
                  <p className="text-xs sm:text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3 sm:mb-4">Your Token Number</p>
                  <div className="text-6xl sm:text-8xl font-bold text-primary tracking-tighter">{tokenResult.tokenNo}</div>
                </div>

                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 flex items-start gap-4 text-left">
                  <Camera className="h-8 w-8 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-800 text-lg">Take a Screenshot!</p>
                    <p className="text-amber-700 mt-1">
                      Please photograph or screenshot your token number <strong>{tokenResult.tokenNo}</strong> so you don't lose your place in the queue.
                    </p>
                  </div>
                </div>

                <p className="text-lg text-zinc-500">Please take a seat. Watch the TV screen for your turn.</p>

                <Button
                  onClick={resetForm}
                  className="h-14 px-8 text-lg font-bold rounded-xl"
                  variant="outline"
                >
                  Done
                </Button>
                <p className="text-sm text-zinc-400 mt-4">
                  Screen resets in <span className="font-bold text-zinc-600">{countdown}s</span>
                </p>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
