"use client";

import Link from "next/link";
import { signOut } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScanLine, LogOut } from "lucide-react";

export function NavBar({ email, isAdmin }: { email: string; isAdmin?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname?.startsWith(href);

  const navItem = (href: string, label: string, exact = false) => (
    <Link
      key={href}
      href={href}
      className={`relative rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
        isActive(href, exact)
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto flex h-14 items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-5">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <ScanLine className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden font-semibold text-foreground text-sm tracking-tight sm:inline">CardScan</span>
          </Link>
          <nav className="flex items-center gap-0.5">
            {navItem("/", "Scan", true)}
            {navItem("/import", "Import", true)}
            {navItem("/leads", "Leads")}
            {isAdmin && navItem("/admin", "Admin", true)}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden md:block truncate max-w-[180px]">
            {email}
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => signOut().then(() => router.push("/sign-in"))}
            className="gap-1.5"
          >
            <LogOut className="size-3" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
