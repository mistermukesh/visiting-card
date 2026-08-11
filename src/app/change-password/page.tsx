"use client";

import { useState, useRef } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { revealDown } from "@/lib/anim";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScanLine, AlertCircle, Loader2 } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const markPasswordChanged = useMutation(api.users.markPasswordChanged);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (newPassword === currentPassword) { setError("New password must be different from current"); return; }

    setLoading(true);
    try {
      const { error } = await authClient.changePassword({ currentPassword, newPassword });
      if (error) { setError(error.message ?? "Password change failed"); return; }
      await markPasswordChanged();
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

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
            <p className="text-sm text-muted-foreground mt-0.5">One-time password setup</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create your password</CardTitle>
            <CardDescription>
              You were given a temporary password. Set a permanent one to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current">Temporary password</Label>
                <Input
                  id="current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-9"
                />
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label htmlFor="new">New password</Label>
                <Input
                  id="new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Min 8 characters"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
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

              <Button type="submit" disabled={loading} className="w-full h-9">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : "Set new password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
