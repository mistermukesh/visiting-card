"use client";

import { useState, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import { fadeUp, revealDown } from "@/lib/anim";
import { NavBar } from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const { session, loading, isAdmin } = useAuthGuard();
  const createUser = useAction(api.admin.createUserAsAdmin);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!loading) fadeUp(containerRef.current, { y: 12 });
    },
    { dependencies: [loading] }
  );

  useGSAP(
    () => {
      if (error) revealDown(errorRef.current);
    },
    { dependencies: [error] }
  );

  useGSAP(
    () => {
      if (success) revealDown(successRef.current);
    },
    { dependencies: [success] }
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    router.push("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(null);
    setSubmitting(true);
    try {
      const result = await createUser({ email, name, password });
      setSuccess(result.email);
      setName("");
      setEmail("");
      setPassword("");
    } catch (err: any) {
      setError(err.message ?? "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar email={session.user.email} isAdmin={isAdmin} />

      <main className="max-w-lg mx-auto px-6 py-8">
        <div ref={containerRef} className="invisible space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Admin</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Manage user access to CardScan.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="size-4" />
                Create new user
              </CardTitle>
              <CardDescription>
                The user will be prompted to set a new password on first login.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Priya Sharma"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="user@example.com"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Temporary password</Label>
                  <Input
                    id="password"
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    className="h-9 font-mono"
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
                {success && (
                  <div ref={successRef} className="overflow-hidden">
                    <div className="flex items-start gap-2.5 rounded-lg bg-green-50 border border-green-100 px-3.5 py-2.5">
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-700">User created</p>
                        <p className="text-xs text-green-600 mt-0.5">
                          Share the temporary password with <strong>{success}</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Button type="submit" disabled={submitting} className="w-full gap-2">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Create user
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
