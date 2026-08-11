"use client";

import { createWorker, PSM } from "tesseract.js";
import { useState, useRef, useCallback } from "react";
import { extractCardInfo, type CardInfo } from "./actions";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import Link from "next/link";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { NavBar } from "@/components/NavBar";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { useGSAP } from "@gsap/react";
import { fadeUp, staggerIn } from "@/lib/anim";
import { Input } from "@/components/ui/input";
import {
  RotateCcw, RotateCw, X, AlertCircle, CheckCircle,
  Loader2, Save, ArrowRight, FileText, Sparkles, Phone, Mail, Globe, MapPin,
  Pencil, Plus, Trash2,
} from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";

type Status = "idle" | "ocr" | "ai" | "done" | "error";
type CropRect = { x: number; y: number; w: number; h: number };
type BatchItem = {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "ocr" | "ai" | "done" | "error";
  progress: number;
  rawText: string;
  info: CardInfo | null;
  editing: boolean;
  saved: boolean;
};

const MIN_SIDE = 1200;

async function preprocessImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(1, MIN_SIDE / Math.min(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  const winHalf = Math.max(3, Math.floor(Math.min(w, h) * 0.06));
  const T = 0.15;
  const integral = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      integral[(y + 1) * (w + 1) + (x + 1)] =
        d[(y * w + x) * 4] + integral[y * (w + 1) + (x + 1)] +
        integral[(y + 1) * (w + 1) + x] - integral[y * (w + 1) + x];
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - winHalf), y1 = Math.max(0, y - winHalf);
      const x2 = Math.min(w - 1, x + winHalf), y2 = Math.min(h - 1, y + winHalf);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = integral[(y2 + 1) * (w + 1) + (x2 + 1)] - integral[y1 * (w + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (w + 1) + x1] + integral[y1 * (w + 1) + x1];
      const i = (y * w + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = d[i] * count < sum * (1 - T) ? 0 : 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

function CardView({ info }: { info: CardInfo }) {
  return (
    <>
      {(info.company || info.tagline) && (
        <div className="px-4 py-3.5 border-b border-border/50 bg-secondary/30 rounded-t-xl">
          {info.company && <p className="font-semibold text-foreground">{info.company}</p>}
          {info.tagline && <p className="text-sm text-muted-foreground mt-0.5">{info.tagline}</p>}
        </div>
      )}
      <CardContent className="divide-y divide-border/50 py-0">
        {info.contacts.length > 0 && (
          <div className="py-3.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5 flex items-center gap-1.5"><Phone className="size-3" /> Contacts</p>
            <div className="space-y-2">
              {info.contacts.map((c, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold text-foreground">{c.name}</p>
                  {c.phones.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-1">
                      {c.phones.map((p, j) => (
                        <a key={j} href={`tel:${p}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{p}</a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {info.email && (
          <div className="py-3.5 flex gap-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-0.5 flex items-center gap-1.5"><Mail className="size-3" /> Email</p>
            <a href={`mailto:${info.email}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{info.email}</a>
          </div>
        )}
        {info.website && (
          <div className="py-3.5 flex gap-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-0.5 flex items-center gap-1.5"><Globe className="size-3" /> Web</p>
            <a href={info.website.startsWith("http") ? info.website : `https://${info.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{info.website}</a>
          </div>
        )}
        {info.addresses.length > 0 && (
          <div className="py-3.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5"><MapPin className="size-3" /> Addresses</p>
            <div className="space-y-1.5">
              {info.addresses.map((a, i) => (
                <div key={i} className="text-sm text-muted-foreground">
                  {a.type && <span className="font-medium text-foreground/50 mr-1.5 text-xs uppercase">{a.type}</span>}
                  {a.value}
                </div>
              ))}
            </div>
          </div>
        )}
        {info.gstin && (
          <div className="py-3.5 flex gap-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-0.5">GSTIN</p>
            <span className="text-sm font-mono text-foreground">{info.gstin}</span>
          </div>
        )}
        {info.services.length > 0 && (
          <div className="py-3.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Services</p>
            <div className="flex flex-wrap  gap-1.5">
              {info.services.map((s, i) => (
                <Badge key={i} variant="secondary" className="font-normal">{s}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </>
  );
}

function CardEditForm({ value, onChange }: { value: CardInfo; onChange: (c: CardInfo) => void }) {
  const up = (partial: Partial<CardInfo>) => onChange({ ...value, ...partial });
  return (
    <CardContent className="divide-y divide-border/50 py-0">
      {/* Company + Tagline */}
      <div className="py-3.5 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company</p>
        <Input value={value.company ?? ""} onChange={(e) => up({ company: e.target.value || null })} placeholder="Company name" className="h-8 text-sm" />
        <Input value={value.tagline ?? ""} onChange={(e) => up({ tagline: e.target.value || null })} placeholder="Tagline" className="h-8 text-sm" />
      </div>
      {/* Contacts */}
      <div className="py-3.5 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Phone className="size-3" /> Contacts</p>
        {value.contacts.map((c, ci) => (
          <div key={ci} className="space-y-2 p-3 rounded-lg bg-secondary/30">
            <div className="flex gap-2">
              <Input value={c.name} onChange={(e) => { const contacts = [...value.contacts]; contacts[ci] = { ...contacts[ci], name: e.target.value }; up({ contacts }); }} placeholder="Name" className="h-8 text-sm flex-1" />
              {value.contacts.length > 1 && (
                <button onClick={() => up({ contacts: value.contacts.filter((_, i) => i !== ci) })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
              )}
            </div>
            {c.phones.map((p, pi) => (
              <div key={pi} className="flex gap-2">
                <Input value={p} onChange={(e) => { const contacts = [...value.contacts]; const phones = [...contacts[ci].phones]; phones[pi] = e.target.value; contacts[ci] = { ...contacts[ci], phones }; up({ contacts }); }} placeholder="Phone" className="h-8 text-sm flex-1 font-mono" />
                {c.phones.length > 1 && (
                  <button onClick={() => { const contacts = [...value.contacts]; contacts[ci] = { ...contacts[ci], phones: contacts[ci].phones.filter((_, i) => i !== pi) }; up({ contacts }); }} className="text-muted-foreground hover:text-destructive"><X className="size-4" /></button>
                )}
              </div>
            ))}
            <button onClick={() => { const contacts = [...value.contacts]; contacts[ci] = { ...contacts[ci], phones: [...contacts[ci].phones, ""] }; up({ contacts }); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Plus className="size-3" /> Add phone</button>
          </div>
        ))}
        <button onClick={() => up({ contacts: [...value.contacts, { name: "", phones: [""] }] })} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Plus className="size-3" /> Add contact</button>
      </div>
      {/* Email */}
      <div className="py-3.5 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Mail className="size-3" /> Email</p>
        <Input value={value.email ?? ""} onChange={(e) => up({ email: e.target.value || null })} placeholder="email@example.com" type="email" className="h-8 text-sm" />
      </div>
      {/* Website */}
      <div className="py-3.5 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Globe className="size-3" /> Website</p>
        <Input value={value.website ?? ""} onChange={(e) => up({ website: e.target.value || null })} placeholder="https://example.com" className="h-8 text-sm" />
      </div>
      {/* Addresses */}
      <div className="py-3.5 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><MapPin className="size-3" /> Addresses</p>
        {value.addresses.map((a, i) => (
          <div key={i} className="flex gap-2">
            <Input value={a.type} onChange={(e) => { const addresses = [...value.addresses]; addresses[i] = { ...addresses[i], type: e.target.value }; up({ addresses }); }} placeholder="Type" className="h-8 text-sm w-24 shrink-0" />
            <Input value={a.value} onChange={(e) => { const addresses = [...value.addresses]; addresses[i] = { ...addresses[i], value: e.target.value }; up({ addresses }); }} placeholder="Address" className="h-8 text-sm flex-1" />
            <button onClick={() => up({ addresses: value.addresses.filter((_, idx) => idx !== i) })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
          </div>
        ))}
        <button onClick={() => up({ addresses: [...value.addresses, { type: "", value: "" }] })} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Plus className="size-3" /> Add address</button>
      </div>
      {/* GSTIN */}
      <div className="py-3.5 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">GSTIN</p>
        <Input value={value.gstin ?? ""} onChange={(e) => up({ gstin: e.target.value || null })} placeholder="GSTIN" className="h-8 text-sm font-mono" />
      </div>
      {/* Services */}
      <div className="py-3.5 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Services</p>
        <Input value={value.services.join(", ")} onChange={(e) => up({ services: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Deals, Electronic (comma separated)" className="h-8 text-sm" />
      </div>
    </CardContent>
  );
}

function ImageEditor({ file, onApply, onCancel }: {
  file: File;
  onApply: (f: File) => void;
  onCancel: () => void;
}) {
  const [work, setWork] = useState<File>(file);
  const [preview, setPreview] = useState<string>(() => URL.createObjectURL(file));
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const rotate = useCallback(async (dir: "cw" | "ccw") => {
    try {
      const bitmap = await createImageBitmap(work);
      const rad = dir === "cw" ? Math.PI / 2 : -Math.PI / 2;
      const outW = bitmap.height, outH = bitmap.width;
      const canvas = document.createElement("canvas");
      canvas.width = outW; canvas.height = outH;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate(rad);
      ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const f = new File([blob], work.name, { type: "image/png" });
      setWork(f);
      setPreview(URL.createObjectURL(blob));
      setCropRect(null);
    } catch { /* ignore */ }
  }, [work]);

  const relPos = (e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = relPos(e);
    if (!p) return;
    setDragStart(p); setIsDragging(true); setCropRect(null);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStart) return;
    const p = relPos(e);
    if (!p) return;
    setCropRect({
      x: Math.min(dragStart.x, p.x), y: Math.min(dragStart.y, p.y),
      w: Math.abs(p.x - dragStart.x), h: Math.abs(p.y - dragStart.y),
    });
  };
  const onUp = () => {
    if (!isDragging) return;
    setIsDragging(false); setDragStart(null);
    setCropRect((prev) => (prev && (prev.w < 0.02 || prev.h < 0.02) ? null : prev));
  };

  const apply = useCallback(async () => {
    try {
      if (cropRect && cropRect.w > 0.02 && cropRect.h > 0.02) {
        const bitmap = await createImageBitmap(work);
        const cx = Math.round(cropRect.x * bitmap.width), cy = Math.round(cropRect.y * bitmap.height);
        const cw = Math.round(cropRect.w * bitmap.width), ch = Math.round(cropRect.h * bitmap.height);
        const canvas = document.createElement("canvas");
        canvas.width = cw; canvas.height = ch;
        canvas.getContext("2d")!.drawImage(bitmap, cx, cy, cw, ch, 0, 0, cw, ch);
        const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
        onApply(new File([blob], work.name, { type: "image/png" }));
      } else {
        onApply(work);
      }
    } catch { onApply(work); }
  }, [cropRect, work, onApply]);

  return (
    <Card>
      <CardHeader className="border-b border-border/50 py-3 px-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Adjust image</p>
          <p className="text-xs text-muted-foreground">Drag to crop</p>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="flex justify-center">
          <div
            ref={containerRef}
            className="relative inline-block select-none cursor-crosshair rounded-lg overflow-hidden shadow-sm touch-none"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Edit preview" className="block max-h-64 w-auto" draggable={false} />
            {cropRect && (
              <>
                <div className="absolute top-0 left-0 right-0 bg-black/40 pointer-events-none" style={{ height: `${cropRect.y * 100}%` }} />
                <div className="absolute bottom-0 left-0 right-0 bg-black/40 pointer-events-none" style={{ height: `${(1 - cropRect.y - cropRect.h) * 100}%` }} />
                <div className="absolute bg-black/40 pointer-events-none" style={{ top: `${cropRect.y * 100}%`, left: 0, width: `${cropRect.x * 100}%`, height: `${cropRect.h * 100}%` }} />
                <div className="absolute bg-black/40 pointer-events-none" style={{ top: `${cropRect.y * 100}%`, right: 0, width: `${(1 - cropRect.x - cropRect.w) * 100}%`, height: `${cropRect.h * 100}%` }} />
                <div className="absolute border-2 border-white pointer-events-none" style={{ left: `${cropRect.x * 100}%`, top: `${cropRect.y * 100}%`, width: `${cropRect.w * 100}%`, height: `${cropRect.h * 100}%` }} />
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => rotate("ccw")} className="gap-1.5">
              <RotateCcw className="size-3.5" /> Left
            </Button>
            <Button variant="secondary" size="sm" onClick={() => rotate("cw")} className="gap-1.5">
              <RotateCw className="size-3.5" /> Right
            </Button>
            {cropRect && (
              <Button variant="ghost" size="sm" onClick={() => setCropRect(null)}>Clear crop</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" onClick={apply} className="gap-1.5">Apply</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function itemTitle(item: BatchItem): string {
  return item.info?.company || item.info?.contacts[0]?.name || item.file.name;
}

function BatchQueue({
  items, started, saving, onStart, onAddFiles, onEditImage, onEditToggle, onCardChange, onRemove, onSaveAll, onReset,
}: {
  items: BatchItem[];
  started: boolean;
  saving: boolean;
  onStart: () => void;
  onAddFiles: (files: File[]) => void;
  onEditImage: (id: string, file: File) => void;
  onEditToggle: (id: string, editing: boolean) => void;
  onCardChange: (id: string, info: CardInfo) => void;
  onRemove: (id: string) => void;
  onSaveAll: () => void;
  onReset: () => void;
}) {
  const addRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const processing = items.some((it) => it.status === "pending" || it.status === "ocr" || it.status === "ai");
  const doneCount = items.filter((it) => it.status === "done").length;
  const savable = items.filter((it) => it.status === "done" && !it.saved && it.info).length;
  const savedCount = items.filter((it) => it.saved).length;

  if (!started) {
    const editItem = items.find((it) => it.id === editingId);
    if (editItem) {
      return (
        <ImageEditor
          key={editItem.id}
          file={editItem.file}
          onApply={(f) => { onEditImage(editItem.id, f); setEditingId(null); }}
          onCancel={() => setEditingId(null)}
        />
      );
    }
    return (
      <div className="space-y-4">
        <input
          ref={addRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { onAddFiles(Array.from(e.target.files ?? [])); if (addRef.current) addRef.current.value = ""; }}
        />
        {/* Staging action bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{items.length} images ready to scan</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => addRef.current?.click()}>
              <Plus className="size-3.5" /> Add more
            </Button>
            <Button size="sm" className="gap-1.5" onClick={onStart} disabled={items.length === 0}>
              Start scan <ArrowRight className="size-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={onReset}>Cancel</Button>
          </div>
        </div>
        {/* Thumbnail grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="relative group">
              <button
                onClick={() => setEditingId(item.id)}
                className="block w-full cursor-pointer rounded-lg overflow-hidden border border-border transition-shadow hover:ring-2 hover:ring-primary/50"
                aria-label="Crop or rotate"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.preview} alt="" className="w-full aspect-[3/2] object-cover" />
              </button>
              <button
                onClick={() => onRemove(item.id)}
                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                aria-label="Remove"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {processing ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
          <span className="text-sm font-medium text-foreground">
            {processing ? `Scanning ${doneCount}/${items.length}…` : `${doneCount}/${items.length} scanned`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {savable > 0 || saving ? (
            <Button size="sm" onClick={onSaveAll} disabled={saving || savable === 0} className="gap-1.5">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {saving ? "Saving…" : `Save all (${savable})`}
            </Button>
          ) : savedCount > 0 ? (
            <Link href="/leads" className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "gap-1.5 text-green-700 bg-green-50 hover:bg-green-100")}>
              <CheckCircle className="size-3.5" /> {savedCount} saved · View leads
            </Link>
          ) : null}
          <Button size="sm" variant="outline" onClick={onReset}>New batch</Button>
        </div>
      </div>

      {/* Items */}
      {items.map((item) => (
        <Card key={item.id} className="overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 bg-secondary/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.preview} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{itemTitle(item)}</p>
              <p className="text-xs text-muted-foreground">
                {item.status === "pending" && "Queued"}
                {item.status === "ocr" && `Reading… ${item.progress}%`}
                {item.status === "ai" && "Extracting…"}
                {item.status === "done" && (item.saved ? "Saved" : "Ready")}
                {item.status === "error" && "Failed to scan"}
              </p>
            </div>
            {item.status === "done" && !item.saved && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onEditToggle(item.id, !item.editing)}>
                {item.editing ? <><CheckCircle className="size-3.5" /> Done</> : <><Pencil className="size-3.5" /> Edit</>}
              </Button>
            )}
            {item.saved ? (
              <CheckCircle className="size-4 text-green-500 shrink-0" />
            ) : (
              <button onClick={() => onRemove(item.id)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Remove">
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
          {item.status === "done" && item.info && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.preview} alt="Business card" className="w-full max-h-56 object-contain bg-secondary/30 border-b border-border/50" />
              {item.editing
                ? <CardEditForm value={item.info} onChange={(info) => onCardChange(item.id, info)} />
                : <CardView info={item.info} />}
            </>
          )}
        </Card>
      ))}
    </div>
  );
}

export default function CardOCR() {
  const { session, loading, isAdmin } = useAuthGuard();
  const saveCard = useMutation(api.cards.saveCard);
  const generateUploadUrl = useMutation(api.cards.generateUploadUrl);

  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [rawText, setRawText] = useState("");
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingData, setEditingData] = useState(false);
  const [editDraft, setEditDraft] = useState<CardInfo | null>(null);
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [batchStarted, setBatchStarted] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);

  const cropContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!loading) fadeUp(headerRef.current, { y: 10, duration: 0.35 });
    },
    { dependencies: [loading] }
  );

  useGSAP(
    () => {
      if (!loading) fadeUp(panelRef.current, { y: 10 });
    },
    { dependencies: [editMode, status, loading] }
  );

  useGSAP(
    () => {
      if (status === "ocr" || status === "ai" || status === "error") {
        fadeUp(statusRef.current, { y: 8, duration: 0.25 });
      }
    },
    { dependencies: [status] }
  );

  useGSAP(
    () => {
      if (status === "done" && cardInfo) {
        fadeUp(resultsRef.current, { y: 12 });
        const sections = resultsRef.current?.querySelectorAll<HTMLElement>(".result-section");
        if (sections && sections.length) staggerIn(Array.from(sections), 0.1);
      }
    },
    { dependencies: [status, cardInfo] }
  );

  const runOCR = useCallback(async (file: File) => {
    setPreview(URL.createObjectURL(file));
    setScannedFile(file);
    setStatus("ocr");
    setProgress(0);
    setRawText("");
    setCardInfo(null);
    setSaved(false);
    try {
      const processed = await preprocessImage(file);
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_do_invert: "1" });
      const { data } = await worker.recognize(processed);
      await worker.terminate();
      const text = data.text.trim();
      setRawText(text);
      setStatus("ai");
      const info = await extractCardInfo(text);
      setCardInfo(info);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }, []);

  const handleFile = useCallback((file: File | undefined | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
    setEditMode(true);
    setCropRect(null);
    setDragStart(null);
    setIsDragging(false);
  }, []);

  const handleRotate = useCallback(async (dir: "cw" | "ccw") => {
    if (!pendingFile) return;
    try {
      const bitmap = await createImageBitmap(pendingFile);
      const rad = dir === "cw" ? Math.PI / 2 : -Math.PI / 2;
      const outW = bitmap.height, outH = bitmap.width;
      const canvas = document.createElement("canvas");
      canvas.width = outW; canvas.height = outH;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate(rad);
      ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
      setPendingFile(new File([blob], pendingFile.name, { type: "image/png" }));
      setPreview(URL.createObjectURL(blob));
      setCropRect(null);
    } catch { /* ignore */ }
  }, [pendingFile]);

  const applyEditsAndScan = useCallback(async () => {
    if (!pendingFile) return;
    setEditMode(false);
    try {
      if (cropRect && cropRect.w > 0.02 && cropRect.h > 0.02) {
        const bitmap = await createImageBitmap(pendingFile);
        const cx = Math.round(cropRect.x * bitmap.width), cy = Math.round(cropRect.y * bitmap.height);
        const cw = Math.round(cropRect.w * bitmap.width), ch = Math.round(cropRect.h * bitmap.height);
        const canvas = document.createElement("canvas");
        canvas.width = cw; canvas.height = ch;
        canvas.getContext("2d")!.drawImage(bitmap, cx, cy, cw, ch, 0, 0, cw, ch);
        const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
        runOCR(new File([blob], pendingFile.name, { type: "image/png" }));
      } else {
        runOCR(pendingFile);
      }
    } catch { setStatus("error"); }
  }, [pendingFile, cropRect, runOCR]);

  const getRelativePos = useCallback((e: React.PointerEvent) => {
    const el = cropContainerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = getRelativePos(e);
    if (!pos) return;
    setDragStart(pos); setIsDragging(true); setCropRect(null);
  }, [getRelativePos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStart) return;
    const pos = getRelativePos(e);
    if (!pos) return;
    setCropRect({
      x: Math.min(dragStart.x, pos.x), y: Math.min(dragStart.y, pos.y),
      w: Math.abs(pos.x - dragStart.x), h: Math.abs(pos.y - dragStart.y),
    });
  }, [isDragging, dragStart, getRelativePos]);

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false); setDragStart(null);
    setCropRect((prev) => prev && (prev.w < 0.02 || prev.h < 0.02) ? null : prev);
  }, [isDragging]);

  const handleSaveCard = useCallback(async () => {
    if (!cardInfo) return;
    setSaving(true);
    try {
      let imageStorageId: Id<"_storage"> | undefined;
      if (scannedFile) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": scannedFile.type }, body: scannedFile });
        const { storageId } = await res.json();
        imageStorageId = storageId as Id<"_storage">;
      }
      await saveCard({ ...cardInfo, rawText, imageStorageId });
      setSaved(true);
    } finally { setSaving(false); }
  }, [cardInfo, rawText, scannedFile, saveCard, generateUploadUrl]);

  const updateItem = useCallback((id: string, partial: Partial<BatchItem>) => {
    setBatch((prev) => prev.map((it) => (it.id === id ? { ...it, ...partial } : it)));
  }, []);

  const processBatch = useCallback(async (items: BatchItem[]) => {
    for (const item of items) {
      try {
        updateItem(item.id, { status: "ocr", progress: 0 });
        const processed = await preprocessImage(item.file);
        const worker = await createWorker("eng", 1, {
          logger: (m) => {
            if (m.status === "recognizing text") updateItem(item.id, { progress: Math.round(m.progress * 100) });
          },
        });
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_do_invert: "1" });
        const { data } = await worker.recognize(processed);
        await worker.terminate();
        const text = data.text.trim();
        updateItem(item.id, { status: "ai", rawText: text });
        const info = await extractCardInfo(text);
        updateItem(item.id, { status: "done", info });
      } catch {
        updateItem(item.id, { status: "error" });
      }
    }
  }, [updateItem]);

  const handleFiles = useCallback((files: File[]) => {
    if (!files || files.length === 0) return;
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) return;
    if (batch.length === 0 && imgs.length === 1) { handleFile(imgs[0]); return; }
    const items: BatchItem[] = imgs.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      preview: URL.createObjectURL(f),
      status: "pending",
      progress: 0,
      rawText: "",
      info: null,
      editing: false,
      saved: false,
    }));
    setBatch((prev) => [...prev, ...items]);
  }, [batch.length, handleFile]);

  const handleStartBatch = useCallback(() => {
    setBatchStarted(true);
    processBatch(batch.filter((it) => it.status === "pending"));
  }, [batch, processBatch]);

  const handleSaveAll = useCallback(async () => {
    setBatchSaving(true);
    try {
      for (const item of batch) {
        if (item.status !== "done" || !item.info || item.saved) continue;
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": item.file.type }, body: item.file });
        const { storageId } = await res.json();
        await saveCard({ ...item.info, rawText: item.rawText, imageStorageId: storageId as Id<"_storage"> });
        updateItem(item.id, { saved: true, editing: false });
      }
    } finally { setBatchSaving(false); }
  }, [batch, generateUploadUrl, saveCard, updateItem]);

  const reset = () => {
    setStatus("idle"); setProgress(0); setRawText(""); setCardInfo(null);
    setPreview(null); setPendingFile(null); setEditMode(false);
    setCropRect(null); setDragStart(null); setIsDragging(false);
    setSaved(false); setSaving(false); setScannedFile(null);
    setEditingData(false); setEditDraft(null);
    setBatch([]); setBatchStarted(false); setBatchSaving(false);
  };

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

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5 sm:px-6">

        {/* Drop zone */}
        {!editMode && status === "idle" && batch.length === 0 && (
          <div ref={panelRef} className="invisible">
            <FileUpload
              multiple
              onChange={handleFiles}
              title="Upload business card images"
              subtitle="Drag & drop or click to browse · PNG, JPG, WEBP"
            />
          </div>
        )}

          {/* Batch queue */}
          {batch.length > 0 && (
            <BatchQueue
              items={batch}
              started={batchStarted}
              saving={batchSaving}
              onStart={handleStartBatch}
              onAddFiles={(files) => handleFiles(files)}
              onEditImage={(id, file) => updateItem(id, { file, preview: URL.createObjectURL(file) })}
              onEditToggle={(id, editing) => updateItem(id, { editing })}
              onCardChange={(id, info) => updateItem(id, { info })}
              onRemove={(id) => setBatch((prev) => prev.filter((it) => it.id !== id))}
              onSaveAll={handleSaveAll}
              onReset={reset}
            />
          )}

          {/* Image preview during processing */}
          {!editMode && preview && status !== "idle" && (
            <div ref={panelRef} className="invisible">
              <Card className="overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Card preview" className="w-full max-h-56 object-contain bg-secondary/30" />
              </Card>
            </div>
          )}

          {/* Edit / crop panel */}
          {editMode && preview && (
            <div ref={panelRef} className="invisible">
              <Card>
                <CardHeader className="border-b border-border/50 py-3 px-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Adjust image</p>
                    <p className="text-xs text-muted-foreground">Drag to crop</p>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex justify-center">
                    <div
                      ref={cropContainerRef}
                      className="relative inline-block select-none cursor-crosshair rounded-lg overflow-hidden shadow-sm touch-none"
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="Edit preview" className="block max-h-64 w-auto" draggable={false} />
                      {cropRect && (
                        <>
                          <div className="absolute top-0 left-0 right-0 bg-black/40 pointer-events-none" style={{ height: `${cropRect.y * 100}%` }} />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/40 pointer-events-none" style={{ height: `${(1 - cropRect.y - cropRect.h) * 100}%` }} />
                          <div className="absolute bg-black/40 pointer-events-none" style={{ top: `${cropRect.y * 100}%`, left: 0, width: `${cropRect.x * 100}%`, height: `${cropRect.h * 100}%` }} />
                          <div className="absolute bg-black/40 pointer-events-none" style={{ top: `${cropRect.y * 100}%`, right: 0, width: `${(1 - cropRect.x - cropRect.w) * 100}%`, height: `${cropRect.h * 100}%` }} />
                          <div className="absolute border-2 border-white pointer-events-none" style={{ left: `${cropRect.x * 100}%`, top: `${cropRect.y * 100}%`, width: `${cropRect.w * 100}%`, height: `${cropRect.h * 100}%` }} />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => handleRotate("ccw")} className="gap-1.5">
                        <RotateCcw className="size-3.5" /> Left
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleRotate("cw")} className="gap-1.5">
                        <RotateCw className="size-3.5" /> Right
                      </Button>
                      {cropRect && (
                        <Button variant="ghost" size="sm" onClick={() => setCropRect(null)}>
                          Clear crop
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={reset}>
                        <X className="size-3.5" />
                      </Button>
                      <Button size="sm" onClick={applyEditsAndScan} className="gap-1.5">
                        Scan <ArrowRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        {/* OCR progress */}
        {status === "ocr" && (
            <div ref={statusRef} className="invisible">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <Progress value={progress} className="gap-2">
                    <ProgressLabel className="flex items-center gap-2">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">Reading text…</span>
                    </ProgressLabel>
                    <ProgressValue />
                    <ProgressTrack className="h-1.5 bg-secondary">
                      <ProgressIndicator className="bg-primary transition-all duration-300" />
                    </ProgressTrack>
                  </Progress>
                </CardContent>
              </Card>
            </div>
          )}

        {/* AI processing */}
        {status === "ai" && (
            <div ref={statusRef} className="invisible">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Extracting contact info…</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Parsing with GPT-4o mini</p>
                    </div>
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        {/* Error */}
        {status === "error" && (
            <div ref={statusRef} className="invisible">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Processing failed</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Try a clearer image or check your API key.</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={reset}>Try again</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        {/* Results */}
        {status === "done" && cardInfo && (
            <div ref={resultsRef} className="invisible space-y-4">
              {/* Action bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-foreground">
                    {editingData ? "Editing info" : "Info extracted"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {editingData ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingData(false);
                        setEditDraft(null);
                        setTimeout(() => {
                          resultsRef.current?.querySelectorAll<HTMLElement>(".result-section")
                            .forEach(el => { el.style.visibility = "visible"; el.style.opacity = "1"; });
                        }, 0);
                      }}>
                        Cancel
                      </Button>
                      <Button size="sm" className="gap-1.5" onClick={() => {
                        if (editDraft) setCardInfo(editDraft);
                        setEditingData(false);
                        setEditDraft(null);
                      }}>
                        Done editing
                      </Button>
                    </>
                  ) : !saved ? (
                    <>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setEditDraft(JSON.parse(JSON.stringify(cardInfo))); setEditingData(true); }}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <Button size="sm" onClick={handleSaveCard} disabled={saving} className="gap-1.5">
                        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                        {saving ? "Saving…" : "Save lead"}
                      </Button>
                    </>
                  ) : (
                    <Link href="/leads" className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "gap-1.5 text-green-700 bg-green-50 hover:bg-green-100")}>
                      <CheckCircle className="size-3.5" />
                      Saved · View leads
                    </Link>
                  )}
                  {!editingData && <Button size="sm" variant="outline" onClick={reset}>New scan</Button>}
                </div>
              </div>

              {/* Results card */}
              <Card>
                {editingData && editDraft ? (
                  <CardContent className="divide-y divide-border/50 py-0">
                    {/* Company + Tagline */}
                    <div className="py-3.5 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company</p>
                      <Input value={editDraft.company ?? ""} onChange={(e) => setEditDraft((d) => d ? { ...d, company: e.target.value || null } : d)} placeholder="Company name" className="h-8 text-sm" />
                      <Input value={editDraft.tagline ?? ""} onChange={(e) => setEditDraft((d) => d ? { ...d, tagline: e.target.value || null } : d)} placeholder="Tagline" className="h-8 text-sm" />
                    </div>
                    {/* Contacts */}
                    <div className="py-3.5 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Phone className="size-3" /> Contacts</p>
                      {editDraft.contacts.map((c, ci) => (
                        <div key={ci} className="space-y-2 p-3 rounded-lg bg-secondary/30">
                          <div className="flex gap-2">
                            <Input value={c.name} onChange={(e) => setEditDraft((d) => { if (!d) return d; const contacts = [...d.contacts]; contacts[ci] = { ...contacts[ci], name: e.target.value }; return { ...d, contacts }; })} placeholder="Name" className="h-8 text-sm flex-1" />
                            {editDraft.contacts.length > 1 && (
                              <button onClick={() => setEditDraft((d) => d ? { ...d, contacts: d.contacts.filter((_, i) => i !== ci) } : d)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                            )}
                          </div>
                          {c.phones.map((p, pi) => (
                            <div key={pi} className="flex gap-2">
                              <Input value={p} onChange={(e) => setEditDraft((d) => { if (!d) return d; const contacts = [...d.contacts]; const phones = [...contacts[ci].phones]; phones[pi] = e.target.value; contacts[ci] = { ...contacts[ci], phones }; return { ...d, contacts }; })} placeholder="Phone" className="h-8 text-sm flex-1 font-mono" />
                              {c.phones.length > 1 && (
                                <button onClick={() => setEditDraft((d) => { if (!d) return d; const contacts = [...d.contacts]; contacts[ci] = { ...contacts[ci], phones: contacts[ci].phones.filter((_, i) => i !== pi) }; return { ...d, contacts }; })} className="text-muted-foreground hover:text-destructive"><X className="size-4" /></button>
                              )}
                            </div>
                          ))}
                          <button onClick={() => setEditDraft((d) => { if (!d) return d; const contacts = [...d.contacts]; contacts[ci] = { ...contacts[ci], phones: [...contacts[ci].phones, ""] }; return { ...d, contacts }; })} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Plus className="size-3" /> Add phone</button>
                        </div>
                      ))}
                      <button onClick={() => setEditDraft((d) => d ? { ...d, contacts: [...d.contacts, { name: "", phones: [""] }] } : d)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Plus className="size-3" /> Add contact</button>
                    </div>
                    {/* Email */}
                    <div className="py-3.5 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Mail className="size-3" /> Email</p>
                      <Input value={editDraft.email ?? ""} onChange={(e) => setEditDraft((d) => d ? { ...d, email: e.target.value || null } : d)} placeholder="email@example.com" type="email" className="h-8 text-sm" />
                    </div>
                    {/* Website */}
                    <div className="py-3.5 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Globe className="size-3" /> Website</p>
                      <Input value={editDraft.website ?? ""} onChange={(e) => setEditDraft((d) => d ? { ...d, website: e.target.value || null } : d)} placeholder="https://example.com" className="h-8 text-sm" />
                    </div>
                    {/* Addresses */}
                    <div className="py-3.5 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><MapPin className="size-3" /> Addresses</p>
                      {editDraft.addresses.map((a, i) => (
                        <div key={i} className="flex gap-2">
                          <Input value={a.type} onChange={(e) => setEditDraft((d) => { if (!d) return d; const addresses = [...d.addresses]; addresses[i] = { ...addresses[i], type: e.target.value }; return { ...d, addresses }; })} placeholder="Type" className="h-8 text-sm w-24 shrink-0" />
                          <Input value={a.value} onChange={(e) => setEditDraft((d) => { if (!d) return d; const addresses = [...d.addresses]; addresses[i] = { ...addresses[i], value: e.target.value }; return { ...d, addresses }; })} placeholder="Address" className="h-8 text-sm flex-1" />
                          <button onClick={() => setEditDraft((d) => d ? { ...d, addresses: d.addresses.filter((_, idx) => idx !== i) } : d)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                        </div>
                      ))}
                      <button onClick={() => setEditDraft((d) => d ? { ...d, addresses: [...d.addresses, { type: "", value: "" }] } : d)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Plus className="size-3" /> Add address</button>
                    </div>
                    {/* GSTIN */}
                    <div className="py-3.5 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">GSTIN</p>
                      <Input value={editDraft.gstin ?? ""} onChange={(e) => setEditDraft((d) => d ? { ...d, gstin: e.target.value || null } : d)} placeholder="GSTIN" className="h-8 text-sm font-mono" />
                    </div>
                    {/* Services */}
                    <div className="py-3.5 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Services</p>
                      <Input value={editDraft.services.join(", ")} onChange={(e) => setEditDraft((d) => d ? { ...d, services: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : d)} placeholder="Deals, Electronic (comma separated)" className="h-8 text-sm" />
                    </div>
                  </CardContent>
                ) : (
                  <>
                    {(cardInfo.company || cardInfo.tagline) && (
                      <div className="px-4 py-3.5 border-b border-border/50 bg-secondary/30 rounded-t-xl">
                        {cardInfo.company && <p className="font-semibold text-foreground">{cardInfo.company}</p>}
                        {cardInfo.tagline && <p className="text-sm text-muted-foreground mt-0.5">{cardInfo.tagline}</p>}
                      </div>
                    )}
                    <div>
                      <CardContent className="divide-y divide-border/50 py-0">
                        {cardInfo.contacts.length > 0 && (
                          <div className="result-section invisible py-3.5">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5 flex items-center gap-1.5"><Phone className="size-3" /> Contacts</p>
                            <div className="space-y-2">
                              {cardInfo.contacts.map((c, i) => (
                                <div key={i}>
                                  <p className="text-sm font-semibold text-foreground">{c.name}</p>
                                  {c.phones.length > 0 && (
                                    <div className="flex flex-wrap gap-3 mt-1">
                                      {c.phones.map((p, j) => (
                                        <a key={j} href={`tel:${p}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{p}</a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {cardInfo.email && (
                          <div className="result-section invisible py-3.5 flex gap-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-0.5 flex items-center gap-1.5"><Mail className="size-3" /> Email</p>
                            <a href={`mailto:${cardInfo.email}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{cardInfo.email}</a>
                          </div>
                        )}
                        {cardInfo.website && (
                          <div className="result-section invisible py-3.5 flex gap-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-0.5 flex items-center gap-1.5"><Globe className="size-3" /> Web</p>
                            <a href={cardInfo.website.startsWith("http") ? cardInfo.website : `https://${cardInfo.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{cardInfo.website}</a>
                          </div>
                        )}
                        {cardInfo.addresses.length > 0 && (
                          <div className="result-section invisible py-3.5">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5"><MapPin className="size-3" /> Addresses</p>
                            <div className="space-y-1.5">
                              {cardInfo.addresses.map((a, i) => (
                                <div key={i} className="text-sm text-muted-foreground">
                                  {a.type && <span className="font-medium text-foreground/50 mr-1.5 text-xs uppercase">{a.type}</span>}
                                  {a.value}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {cardInfo.gstin && (
                          <div className="result-section invisible py-3.5 flex gap-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-0.5">GSTIN</p>
                            <span className="text-sm font-mono text-foreground">{cardInfo.gstin}</span>
                          </div>
                        )}
                        {cardInfo.services.length > 0 && (
                          <div className="result-section invisible py-3.5">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Services</p>
                            <div className="flex flex-wrap gap-1.5">
                              {cardInfo.services.map((s, i) => (
                                <Badge key={i} variant="secondary" className="font-normal">{s}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}
      </main>
    </div>
  );
}
