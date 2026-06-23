import { useState, useEffect } from "react";
import { useLookupCandidate, useCreateCandidate, useCheckinCandidate } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

type Step = 'HOME' | 'PRE_REGISTERED_LOOKUP' | 'NEW_REGISTRATION' | 'CONFIRMATION';

export default function Checkin() {
  const [step, setStep] = useState<Step>('HOME');
  const [identifier, setIdentifier] = useState("");
  
  // Registration form
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [experience, setExperience] = useState("");

  const [tokenResult, setTokenResult] = useState<{ tokenNo: string; name: string; position: string } | null>(null);

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
    setStep('HOME');
  };

  useEffect(() => {
    if (step === 'CONFIRMATION') {
      const timer = setTimeout(resetForm, 10000);
      return () => clearTimeout(timer);
    }
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
    } catch (err) {
      alert("Could not find registration. Please register as a new candidate.");
      setStep('NEW_REGISTRATION');
      if (identifier.includes('@')) setEmail(identifier);
      else setMobile(identifier);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const candidate = await createMutation.mutateAsync({
        data: { name, mobile, email, position, experience }
      });
      
      const result = await checkinMutation.mutateAsync({ id: candidate.id });
      setTokenResult({
        tokenNo: result.tokenNo,
        name: candidate.name,
        position: candidate.position
      });
      setStep('CONFIRMATION');
    } catch (err) {
      alert("Registration failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-primary rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-primary/20">
            <span className="text-3xl font-bold text-primary-foreground">W</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 mb-2">Self Check-In</h1>
          <p className="text-xl text-zinc-500">Welcome to our interview event</p>
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
                    onClick={() => setStep('NEW_REGISTRATION')}
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
              </div>
            )}

            {step === 'NEW_REGISTRATION' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center">
                  <Button variant="ghost" size="icon" onClick={() => setStep('HOME')} className="mr-4 rounded-full h-12 w-12 hover:bg-zinc-100">
                    <ArrowLeft className="h-6 w-6" />
                  </Button>
                  <h2 className="text-2xl font-bold">New Registration</h2>
                </div>
                
                <form onSubmit={handleRegister} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Full Name</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} required className="h-14 text-lg bg-zinc-50 border-zinc-200" />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Mobile Number</Label>
                      <Input value={mobile} onChange={(e) => setMobile(e.target.value)} required className="h-14 text-lg bg-zinc-50 border-zinc-200" />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Email Address</Label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-14 text-lg bg-zinc-50 border-zinc-200" />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Position Applied</Label>
                      <Input value={position} onChange={(e) => setPosition(e.target.value)} required className="h-14 text-lg bg-zinc-50 border-zinc-200" />
                    </div>
                    <div className="space-y-3 md:col-span-2">
                      <Label className="text-base font-semibold">Years of Experience</Label>
                      <Input value={experience} onChange={(e) => setExperience(e.target.value)} className="h-14 text-lg bg-zinc-50 border-zinc-200" />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-16 text-xl font-bold rounded-xl mt-4"
                    disabled={createMutation.isPending || checkinMutation.isPending}
                  >
                    {createMutation.isPending || checkinMutation.isPending ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : "Complete Registration"}
                  </Button>
                </form>
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
                
                <p className="text-lg text-zinc-500 mb-8">Please take a seat. Watch the TV screen for your turn.</p>
                
                <Button 
                  onClick={resetForm}
                  className="h-14 px-8 text-lg font-bold rounded-xl"
                  variant="outline"
                >
                  Done
                </Button>
                <p className="text-sm text-zinc-400 mt-4">Screen will auto-reset in 10 seconds</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
