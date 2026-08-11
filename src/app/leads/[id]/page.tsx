"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { NavBar } from "@/components/NavBar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { useGSAP } from "@gsap/react";
import { fadeUp, staggerIn } from "@/lib/anim";
import { useState, useCallback, useRef } from "react";
import { ChevronRight, Copy, Check, Phone, Mail, Globe, MapPin } from "lucide-react";

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }, []);
  return { copiedKey, copy };
}

function CopyBtn({ text, id, copiedKey, onCopy }: {
  text: string; id: string; copiedKey: string | null; onCopy: (t: string, k: string) => void;
}) {
  const copied = copiedKey === id;
  return (
    <button
      onClick={(e) => { e.preventDefault(); onCopy(text, id); }}
      className={`ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-all active:scale-90 ${
        copied
          ? "bg-green-50 text-green-600 border border-green-100"
          : "bg-secondary text-muted-foreground hover:text-foreground"
      }`}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as Id<"cardLeads">;
  const { session, loading, isAdmin } = useAuthGuard();
  const card = useQuery(api.cards.getCard, session ? { id } : "skip");
  const { copiedKey, copy } = useCopy();

  const breadcrumbRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);

  const ready = !loading && !!card;

  useGSAP(
    () => {
      if (!ready) return;
      fadeUp(breadcrumbRef.current, { y: 0, duration: 0.3 });
      fadeUp(heroRef.current, { y: 12, delay: 0.05 });
      const sections = sectionsRef.current?.querySelectorAll<HTMLElement>(".info-section");
      if (sections && sections.length) staggerIn(Array.from(sections), 0.15);
    },
    { dependencies: [ready] }
  );

  if (loading || card === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  if (card === null) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar email={session.user.email} isAdmin={isAdmin} />
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <p className="text-sm text-muted-foreground">Lead not found.</p>
          <Link href="/leads" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            ← Back to leads
          </Link>
        </div>
      </div>
    );
  }

  const avatarLetter =
    card.company?.charAt(0).toUpperCase() ??
    card.contacts[0]?.name.charAt(0).toUpperCase() ??
    "?";

  return (
    <div className="min-h-screen bg-background">
      <NavBar email={session.user.email} isAdmin={isAdmin} />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5 sm:px-6">
        {/* Breadcrumb */}
        <div
          ref={breadcrumbRef}
          className="invisible flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Link href="/leads" className="hover:text-foreground transition-colors">Leads</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground truncate max-w-xs">
            {card.company ?? card.contacts[0]?.name ?? "Lead"}
          </span>
        </div>

        {/* Hero card */}
        <div ref={heroRef} className="invisible">
          <Card className="overflow-hidden">
            {card.imageUrl && (
              <div className="border-b border-border/50 bg-secondary/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.imageUrl}
                  alt="Business card"
                  className="w-full max-h-64 object-contain"
                />
              </div>
            )}
            <CardContent className="flex items-start gap-4 pt-4">
              <Avatar size="lg">
                <AvatarFallback className="text-base font-bold bg-secondary">
                  {avatarLetter}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                {card.company && (
                  <h1 className="text-lg font-semibold text-foreground leading-tight">{card.company}</h1>
                )}
                {card.tagline && (
                  <p className="text-sm text-muted-foreground mt-0.5">{card.tagline}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Scanned {new Date(card.scannedAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info sections */}
        <div ref={sectionsRef}>
          <Card>
            <CardContent className="divide-y divide-border/50 py-0">
              {/* Contacts */}
              {card.contacts.length > 0 && (
                <div className="info-section invisible py-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Phone className="size-3" /> Contacts
                  </p>
                  <div className="space-y-3">
                    {card.contacts.map((c, i) => (
                      <div key={i}>
                        <p className="text-sm font-semibold text-foreground">{c.name}</p>
                        {c.phones.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {c.phones.map((p, j) => (
                              <div key={j} className="flex items-center">
                                <a href={`tel:${p}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                                  {p}
                                </a>
                                <CopyBtn text={p} id={`phone-${i}-${j}`} copiedKey={copiedKey} onCopy={copy} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email */}
              {card.email && (
                <div className="info-section invisible py-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Mail className="size-3" /> Email
                  </p>
                  <div className="flex items-center">
                    <a href={`mailto:${card.email}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {card.email}
                    </a>
                    <CopyBtn text={card.email} id="email" copiedKey={copiedKey} onCopy={copy} />
                  </div>
                </div>
              )}

              {/* Website */}
              {card.website && (
                <div className="info-section invisible py-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Globe className="size-3" /> Website
                  </p>
                  <div className="flex items-center">
                    <a
                      href={card.website.startsWith("http") ? card.website : `https://${card.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {card.website}
                    </a>
                    <CopyBtn text={card.website} id="website" copiedKey={copiedKey} onCopy={copy} />
                  </div>
                </div>
              )}

              {/* Addresses */}
              {card.addresses.length > 0 && (
                <div className="info-section invisible py-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <MapPin className="size-3" /> {card.addresses.length > 1 ? "Addresses" : "Address"}
                  </p>
                  <div className="space-y-2">
                    {card.addresses.map((a, i) => (
                      <div key={i} className="text-sm text-muted-foreground">
                        {a.type && (
                          <span className="font-medium text-foreground/50 mr-1.5 text-xs uppercase tracking-wide">
                            {a.type}
                          </span>
                        )}
                        <span>{a.value}</span>
                        <CopyBtn text={a.value} id={`addr-${i}`} copiedKey={copiedKey} onCopy={copy} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* GSTIN */}
              {card.gstin && (
                <div className="info-section invisible py-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">GSTIN</p>
                  <div className="flex items-center">
                    <span className="text-sm font-mono text-foreground">{card.gstin}</span>
                    <CopyBtn text={card.gstin} id="gstin" copiedKey={copiedKey} onCopy={copy} />
                  </div>
                </div>
              )}

              {/* Services */}
              {card.services.length > 0 && (
                <div className="info-section invisible py-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Services</p>
                  <div className="flex flex-wrap gap-1.5">
                    {card.services.map((s, i) => (
                      <Badge key={i} variant="secondary" className="font-normal">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
