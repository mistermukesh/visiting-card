"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { NavBar } from "@/components/NavBar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { fadeUp, staggerIn } from "@/lib/anim";
import { Plus, ChevronRight, ScanLine } from "lucide-react";

const PAGE_SIZE = 10;

export default function LeadsPage() {
  const { session, loading, isAdmin } = useAuthGuard();

  const { results, status, loadMore } = usePaginatedQuery(
    api.cards.listCards,
    session ? {} : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const headerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!loading) fadeUp(headerRef.current, { y: 10 });
    },
    { dependencies: [loading] }
  );

  useGSAP(
    () => {
      const el = listRef.current;
      if (!el) return;
      const items = el.querySelectorAll<HTMLElement>(".lead-item:not([data-animated])");
      if (items.length === 0) return;
      items.forEach((n) => (n.dataset.animated = "true"));
      staggerIn(Array.from(items));
    },
    { dependencies: [results.length], scope: listRef }
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar email={session.user.email} isAdmin={isAdmin} />

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
        {/* Header */}
        <div ref={headerRef} className="invisible flex items-end justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Leads</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {status === "LoadingFirstPage"
                ? "Loading…"
                : results.length === 0
                ? "No leads yet"
                : `${results.length}${status === "CanLoadMore" ? "+" : ""} lead${results.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link href="/" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
            <Plus className="size-3.5" />
            New scan
          </Link>
        </div>

        {/* Skeleton loading */}
        {status === "LoadingFirstPage" && (
          <div className="space-y-2.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl bg-card ring-1 ring-foreground/10 p-4 animate-pulse">
                <div className="flex gap-3 items-center">
                  <div className="h-9 w-9 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {status !== "LoadingFirstPage" && results.length === 0 && (
          <div>
              <Card className="py-20 flex flex-col items-center gap-4 text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                  <ScanLine className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">No leads yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Scan your first business card to get started.
                  </p>
                </div>
                <Link href="/" className={cn(buttonVariants({ size: "sm" }), "gap-1.5 mt-1")}>
                  <Plus className="size-3.5" />
                  Scan a card
                </Link>
              </Card>
          </div>
        )}

        {/* Lead list */}
        {results.length > 0 && (
          <div ref={listRef} className="space-y-2">
            {results.map((card) => (
              <div key={card._id} className="lead-item invisible transition-transform hover:-translate-y-px">
                  <Link href={`/leads/${card._id}`}>
                    <Card className="flex items-center gap-3 px-3.5 py-3.5 hover:ring-foreground/20 cursor-pointer transition-shadow sm:gap-4 sm:px-4">
                      <Avatar>
                        <AvatarFallback className="text-sm font-semibold bg-secondary text-secondary-foreground">
                          {(card.company ?? card.contacts[0]?.name ?? "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          {card.company && (
                            <span className="font-semibold text-sm text-foreground">{card.company}</span>
                          )}
                          {card.contacts.map((c, i) => (
                            <span key={i} className="text-sm text-muted-foreground">{c.name}</span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {card.email && <span>{card.email}</span>}
                          {card.contacts.flatMap((c) => c.phones).slice(0, 2).map((p, i) => (
                            <span key={i}>{p}</span>
                          ))}
                        </div>
                        {card.services.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {card.services.slice(0, 3).map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-xs font-normal">
                                {s}
                              </Badge>
                            ))}
                            {card.services.length > 3 && (
                              <span className="text-xs text-muted-foreground self-center">
                                +{card.services.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {new Date(card.scannedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                    </Card>
                  </Link>
              </div>
            ))}

            {status === "CanLoadMore" && (
              <div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => loadMore(PAGE_SIZE)}
                >
                  Load more leads
                </Button>
              </div>
            )}

            {status === "LoadingMore" && (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
              </div>
            )}

            {status === "Exhausted" && results.length > PAGE_SIZE && (
              <p className="text-center text-xs text-muted-foreground py-2">
                All {results.length} leads loaded
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
