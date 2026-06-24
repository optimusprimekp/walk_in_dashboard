import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        localStorage.setItem("auth_token", data.token);
        toast({
          title: "Login successful",
          description: `Welcome back, ${data.user.name}`,
        });
        setLocation("/");
      },
      onError: () => {
        toast({
          title: "Login failed",
          description: "Invalid credentials",
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { username, password } });
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <img src="/kp-logo.png" alt="KP Group" className="h-20 w-20 object-contain" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              KP Group of Companies
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Walk-In Interview Management System
            </p>
          </div>

          <Card className="border-muted/50 shadow-xl shadow-black/5 dark:shadow-black/20">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center">Sign in</CardTitle>
              <CardDescription className="text-center">
                Enter your credentials to access the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="admin"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="bg-muted/50 border-muted focus-visible:ring-primary h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-muted/50 border-muted focus-visible:ring-primary h-11"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-semibold"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="hidden lg:flex flex-1 bg-muted relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-primary/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-background/0 to-background/0" />
        <div className="w-[80%] max-w-[600px] aspect-square rounded-full border border-primary/20 absolute -right-20 -top-20 opacity-20" />
        <div className="w-[60%] max-w-[400px] aspect-square rounded-full border border-primary/30 absolute right-20 top-20 opacity-20" />
        <div className="z-10 text-center space-y-6 p-12 flex flex-col items-center">
          <img src="/kp-logo.png" alt="KP Group" className="h-40 w-40 object-contain drop-shadow-xl" />
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground max-w-lg">
            KP Group of Companies
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Since 1994 — High-volume interview days managed with real-time urgency.
          </p>
        </div>
      </div>
    </div>
  );
}
