import { useState, useEffect } from "react";
import { useLookupCandidate, useCreateCandidate, useCheckinCandidate } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, CheckCircle2, Camera } from "lucide-react";

type Step = 'HOME' | 'PRE_REGISTERED_LOOKUP' | 'CONFIRMATION';

export default function Checkin() {
  const [step, setStep] = useState<Step>('HOME');
  const [identifier, setIdentifier] = useState("");

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [experience, setExperience] = useState("");

  const [tokenResult, setTokenResult] = useState<{ tokenNo: string; name: string; position: string } | null>(null);
  const [countdown, setCountdown] = useState(30);

  const lookupMutation = useLookupCandidate();
  const createMutation = useCreateCandidate();
  const checkinMutation = useCheckinCandidate();

  const resetForm = () => {
    setIdentifier("");
    setName("");
    setMobile("");
    setEmail("");
    setPosition("");
    setExperience("");
    setTokenResult(null);
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

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) return;

    try {
      const isEmail = identifier.includes('@');
      const candidate = await lookupMutation.mutateAsync({
        data: {
          mobile: !isEmail ? identifier : undefined,
          email: isEmail ? identifier : undefined
        }
      });

      const result = await checkinMutation.mutateAsync({ id: candidate.id });
      setTokenResult({
        tokenNo: result.tokenNo,
        name: candidate.name,
        position: candidate.position
      });
      setStep('CONFIRMATION');
    } catch {
      window.location.href = "https://tally.so/r/WOMlqL";
    }
  };

  const handleRegisterRedirect = () => {
    window.location.href = "https://tally.so/r/WOMlqL";
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <img src="/kp-logo.png" alt="KP Group" className="h-20 w-20 object-contain drop-shadow-lg" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 mb-1">KP Group of Companies</h1>
          <p className="text-xl text-zinc-500">Walk-In Interview Self Check-In</p>
        </div>

        <Card className="border-0 shadow-2xl shadow-zinc-200/50 overflow-hidden bg-white rounded-3xl">
          <CardContent className="p-8 md:p-12">
            {step === 'HOME' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-2xl font-bold text-center mb-8">Are you pre-registered?</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Button
                    onClick={() => setStep('PRE_REGISTERED_LOOKUP')}
                    className="h-32 text-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
                  >
                    YES
                  </Button>
                  <Button
                    onClick={handleRegisterRedirect}
                    variant="outline"
                    className="h-32 text-2xl font-bold border-2 border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 shadow-sm transition-all"
                  >
                    NO
                  </Button>
                </div>
              </div>
            )}

            {step === 'PRE_REGISTERED_LOOKUP' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center">
                  <Button variant="ghost" size="icon" onClick={() => setStep('HOME')} className="mr-4 rounded-full h-12 w-12 hover:bg-zinc-100">
                    <ArrowLeft className="h-6 w-6" />
                  </Button>
                  <h2 className="text-2xl font-bold">Find your registration</h2>
                </div>

                <form onSubmit={handleLookup} className="space-y-6">
                  <div className="space-y-4">
                    <Label htmlFor="identifier" className="text-lg">Mobile Number or Email</Label>
                    <Input
                      id="identifier"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Enter mobile or email..."
                      className="h-16 text-xl px-6 bg-zinc-50 border-zinc-200 rounded-xl"
                      required
                      autoFocus
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-16 text-xl font-bold rounded-xl"
                    disabled={lookupMutation.isPending || checkinMutation.isPending}
                  >
                    {lookupMutation.isPending || checkinMutation.isPending ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : "Find & Generate Token"}
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

            {step === 'CONFIRMATION' && tokenResult && (
              <div className="py-8 text-center space-y-8 animate-in zoom-in-95 duration-500">
                <div className="mx-auto h-24 w-24 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-zinc-900">Welcome, {tokenResult.name}</h2>
                  <p className="text-xl text-zinc-500">Position: {tokenResult.position}</p>
                </div>

                <div className="bg-zinc-50 p-8 rounded-3xl border-2 border-zinc-100 my-8">
                  <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Your Token Number</p>
                  <div className="text-8xl font-bold text-primary tracking-tighter">{tokenResult.tokenNo}</div>
                </div>

                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 flex items-start gap-4 text-left">
                  <Camera className="h-8 w-8 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-800 text-lg">Take a Screenshot!</p>
                    <p className="text-amber-700 mt-1">Please photograph or screenshot your token number <strong>{tokenResult.tokenNo}</strong> so you don't lose your place in the queue.</p>
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
