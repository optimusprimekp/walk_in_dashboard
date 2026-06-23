import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, Clock, CheckCircle2, UserX, Loader2, QrCode, Printer, X } from "lucide-react";
import QRCode from "qrcode";

function getCheckinUrl() {
  return `${window.location.origin}/checkin`;
}

function QrCanvas({ size }: { size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, getCheckinUrl(), {
        width: size,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
    }
  }, [size]);
  return <canvas ref={canvasRef} />;
}

function QrModal({ onClose }: { onClose: () => void }) {
  const url = getCheckinUrl();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between w-full">
          <h2 className="text-xl font-bold">Check-In QR Code</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-inner">
          <QrCanvas size={220} />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">Candidates scan this to check in</p>
          <p className="text-xs font-mono text-primary break-all">{url}</p>
        </div>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" />
          Print QR Code
        </Button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) setLocation("/login");
  }, [setLocation]);

  const { data: stats, isLoading } = useGetDashboardStats({
    query: {
      refetchInterval: 5000,
    },
  });

  if (isLoading || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {showQr && <QrModal onClose={() => setShowQr(false)} />}

      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">
              W
            </div>
            <h1 className="font-semibold text-lg">Command Center</h1>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="text-primary">Dashboard</Link>
            <Link href="/candidates" className="text-muted-foreground hover:text-foreground">Candidates</Link>
            <Link href="/tables" className="text-muted-foreground hover:text-foreground">Tables</Link>
            <Link href="/tv" className="text-muted-foreground hover:text-foreground">TV Display</Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Today's Overview</h2>
            <p className="text-muted-foreground mt-1">Real-time interview pipeline status.</p>
          </div>
          <Button onClick={() => setShowQr(true)} className="gap-2">
            <QrCode className="h-4 w-4" />
            Check-In QR Code
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Checked In</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{stats.checkedIn}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waiting</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{stats.waiting}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Interview</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.inInterview}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">{stats.completed}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="border-emerald-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-600">Selected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">{stats.selected}</div>
            </CardContent>
          </Card>
          <Card className="border-destructive/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-destructive">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
            </CardContent>
          </Card>
          <Card className="border-destructive/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">No Show</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.noShow}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-4 w-4" />
              Quick Check-In Access
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <div className="bg-white p-3 rounded-lg shadow-sm border border-border flex-shrink-0">
              <QrCanvas size={120} />
            </div>
            <div className="space-y-2">
              <p className="font-medium">Candidate Self Check-In</p>
              <p className="text-sm text-muted-foreground">
                Display or print this QR code at the reception desk. Candidates scan it to check in on their own device.
              </p>
              <p className="text-xs font-mono text-primary">{getCheckinUrl()}</p>
              <Button size="sm" variant="outline" onClick={() => setShowQr(true)} className="gap-2 mt-2">
                <QrCode className="h-3 w-3" />
                View Full Size
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
