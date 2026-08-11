"use client";

import * as XLSX from "xlsx";
import { useState, useCallback } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { CardInfo } from "../actions";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { NavBar } from "@/components/NavBar";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import {
  FileSpreadsheet, Loader2, CheckCircle, AlertCircle, ArrowRight, Info,
} from "lucide-react";

type Status = "idle" | "preview" | "importing" | "done" | "error";
type Row = Record<string, string | number | null | undefined>;

type Mapping = {
  company?: string;
  name?: string;
  phones: string[];
  email?: string;
  website?: string;
  addresses: string[];
  gstin?: string;
  services?: string;
  tagline?: string;
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

function detectMapping(headers: string[]): Mapping {
  const m: Mapping = { phones: [], addresses: [] };
  for (const h of headers) {
    const n = norm(h);
    if (!n) continue;
    if (/(gst|gstin)/.test(n)) { m.gstin ??= h; continue; }
    if (/(phone|mobile|contact|number|tel|whatsapp|cell)/.test(n)) { m.phones.push(h); continue; }
    if (/(email|mail)/.test(n)) { m.email ??= h; continue; }
    if (/(company|business|firm|organi|org|concern)/.test(n)) { m.company ??= h; continue; }
    if (/(website|weburl|url|site|web)/.test(n)) { m.website ??= h; continue; }
    if (/(address|location|addr|city|area)/.test(n)) { m.addresses.push(h); continue; }
    if (/(service|product|deal|category|dealsin)/.test(n)) { m.services ??= h; continue; }
    if (/(tagline|slogan|about|description|desc)/.test(n)) { m.tagline ??= h; continue; }
    if (/name/.test(n)) { m.name ??= h; continue; }
  }
  return m;
}

const s = (v: unknown): string => (v == null ? "" : String(v)).trim();

function rowToCard(row: Row, m: Mapping): CardInfo {
  const company = m.company ? s(row[m.company]) : "";
  const name = m.name ? s(row[m.name]) : "";
  const phones = m.phones
    .flatMap((h) => s(row[h]).split(/[,/;|]+/))
    .map((p) => p.trim())
    .filter(Boolean);
  const uniquePhones = Array.from(new Set(phones));
  const email = m.email ? s(row[m.email]) : "";
  const website = m.website ? s(row[m.website]) : "";
  const gstin = m.gstin ? s(row[m.gstin]) : "";
  const tagline = m.tagline ? s(row[m.tagline]) : "";
  const services = m.services
    ? s(row[m.services]).split(/[,/;|]+/).map((x) => x.trim()).filter(Boolean)
    : [];
  const addresses = m.addresses
    .map((h) => ({ type: "", value: s(row[h]) }))
    .filter((a) => a.value);

  const contacts =
    name || uniquePhones.length
      ? [{ name, phones: uniquePhones }]
      : [];

  return {
    company: company || null,
    contacts,
    email: email || null,
    website: website || null,
    addresses,
    gstin: gstin || null,
    services,
    tagline: tagline || null,
  };
}

const hasData = (c: CardInfo) =>
  !!(c.company || c.email || c.contacts.some((ct) => ct.name || ct.phones.length));

export default function ImportPage() {
  const { session, loading, isAdmin } = useAuthGuard();
  const saveCard = useMutation(api.cards.saveCard);

  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState("");
  const [cards, setCards] = useState<CardInfo[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(0);

  const reset = () => {
    setStatus("idle"); setFileName(""); setCards([]); setSkipped(0);
    setMapping(null); setErrorMsg(""); setProgress(0); setFailed(0);
  };

  const handleFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("No sheet found");
      const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: false });
      if (rows.length === 0) throw new Error("File has no rows");
      const headers = Object.keys(rows[0]);
      const m = detectMapping(headers);
      const mapped = rows.map((r) => rowToCard(r, m));
      const good = mapped.filter(hasData);
      setMapping(m);
      setCards(good);
      setSkipped(mapped.length - good.length);
      setStatus(good.length ? "preview" : "error");
      if (!good.length) setErrorMsg("No usable rows found. Check that your file has name/phone/company columns.");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to read file");
      setStatus("error");
    }
  }, []);

  const handleImport = useCallback(async () => {
    setStatus("importing");
    setProgress(0);
    setFailed(0);
    let done = 0;
    let fail = 0;
    for (const card of cards) {
      try {
        await saveCard({ ...card });
      } catch {
        fail += 1;
      }
      done += 1;
      setProgress(done);
    }
    setFailed(fail);
    setStatus("done");
  }, [cards, saveCard]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  const mappedFields = mapping
    ? [
        mapping.name && `Name → ${mapping.name}`,
        mapping.phones.length && `Phone → ${mapping.phones.join(", ")}`,
        mapping.company && `Company → ${mapping.company}`,
        mapping.email && `Email → ${mapping.email}`,
        mapping.website && `Website → ${mapping.website}`,
        mapping.addresses.length && `Address → ${mapping.addresses.join(", ")}`,
        mapping.gstin && `GSTIN → ${mapping.gstin}`,
        mapping.services && `Services → ${mapping.services}`,
        mapping.tagline && `Tagline → ${mapping.tagline}`,
      ].filter(Boolean) as string[]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <NavBar email={session.user.email} isAdmin={isAdmin} />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5 sm:px-6">

        {/* Upload */}
        {status === "idle" && (
          <FileUpload
            onChange={(files) => handleFile(files[0])}
            title="Upload CSV or Excel file"
            subtitle="Drag & drop or click to browse · CSV, XLSX, XLS"
          />
        )}

        {/* Error */}
        {status === "error" && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Could not import</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{errorMsg}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={reset}>Try again</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview */}
        {status === "preview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {cards.length} leads{skipped > 0 ? ` · ${skipped} empty rows skipped` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={reset}>Choose another</Button>
                <Button size="sm" className="gap-1.5" onClick={handleImport}>
                  Import {cards.length} leads <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>

            {mappedFields.length > 0 && (
              <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <Info className="size-3" /> Detected columns
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {mappedFields.map((f, i) => (
                    <span key={i} className="text-xs text-foreground">{f}</span>
                  ))}
                </div>
              </div>
            )}

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-secondary/30 text-left">
                      <th className="px-3 py-2 font-medium text-muted-foreground text-xs">Name</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground text-xs">Phone</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground text-xs">Company</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground text-xs">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.slice(0, 100).map((c, i) => (
                      <tr key={i} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2 text-foreground">{c.contacts[0]?.name || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{c.contacts[0]?.phones.join(", ") || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.company || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {cards.length > 100 && (
                <p className="px-3 py-2 text-xs text-muted-foreground border-t border-border/50">
                  Showing first 100 of {cards.length}.
                </p>
              )}
            </Card>
          </div>
        )}

        {/* Importing */}
        {status === "importing" && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Creating leads…</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{progress} of {cards.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Done */}
        {status === "done" && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Imported {cards.length - failed} leads</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Each was pushed to TeleCRM.{failed > 0 ? ` ${failed} failed and were skipped.` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={reset}>Import more</Button>
                  <Link href="/leads" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
                    View leads
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
