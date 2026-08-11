"use client";

import { useState, useRef } from "react";
import { signIn } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { revealDown } from "@/lib/anim";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScanLine, AlertCircle, Loader2 } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline();
      tl.fromTo(
        containerRef.current,
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.4, ease: "power3.out" }
      );
      tl.fromTo(
        logoRef.current,
        { scale: 0.8, autoAlpha: 0 },
        { scale: 1, autoAlpha: 1, duration: 0.45, ease: "back.out(1.7)" },
        0.1
      );
    },
    { scope: containerRef }
  );

  useGSAP(
    () => {
      if (error) revealDown(errorRef.current);
    },
    { dependencies: [error] }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn.email({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Sign in failed");
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div ref={containerRef} className="invisible w-full max-w-sm space-y-7">
        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          <div
            ref={logoRef}
            className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-sm"
          >
            <ScanLine className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">CardScan</p>
            <p className="text-sm text-muted-foreground mt-0.5">Business card lead manager</p>
          </div>
        </div>

        {/* Form card */}
        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-9"
                />
              </div>

              {error && (
                <div ref={errorRef} className="overflow-hidden">
                  <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 px-3.5 py-2.5">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full h-9" size="lg">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
