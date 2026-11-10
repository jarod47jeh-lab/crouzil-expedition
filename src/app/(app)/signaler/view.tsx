"use client";
/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Check, ImagePlus, Search, Send, Truck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { addRepairPhoto, saveRow } from "@/lib/actions/crud";
import { ASSET_KINDS, URGENCIES } from "@/lib/domain/constants";
import { iso, today } from "@/lib/domain/dates";
import { compressImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import type { Asset, Urgency } from "@/lib/types";
import { cn } from "@/lib/utils";
import { assetLabel } from "../reparations/shared";

/* Problèmes courants : un toucher remplit le type et la description */
const PRESETS: { label: string; category: string; urgency: Urgency; immobilized?: boolean }[] = [
  { label: "Pneu dégonflé", category: "Usure", urgency: "Urgent" },
  { label: "Pneu crevé", category: "Casse", urgency: "Bloquant", immobilized: true },
  { label: "Choc carrosserie", category: "Casse", urgency: "Normal" },
  { label: "Voyant allumé", category: "Panne", urgency: "Urgent" },
  { label: "Hayon en panne", category: "Panne", urgency: "Bloquant", immobilized: true },
  { label: "Feux ou clignotant", category: "Sécurité", urgency: "Urgent" },
  { label: "Rétroviseur cassé", category: "Casse", urgency: "Urgent" },
  { label: "Fuite", category: "Panne", urgency: "Urgent" },
  { label: "Autre", category: "Autre", urgency: "Normal" },
];

type Shot = { file: File; url: string };

export function ReportView({ assets, preset }: { assets: Asset[]; preset?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [asset, setAsset] = useState<string>(preset || "");
  const [q, setQ] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<(typeof PRESETS)[number] | null>(null);
  const [urgency, setUrgency] = useState<Urgency>("Normal");
  const [immobilized, setImmobilized] = useState(false);
  const [desc, setDesc] = useState("");
  const [mileage, setMileage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => () => shots.forEach((s) => URL.revokeObjectURL(s.url)), [shots]);

  const vehicles = useMemo(() => {
    const s = q.trim().toLowerCase();
    return assets
      .filter((a) => !s || [a.name, a.ref, a.designation, a.assigned_to].some((x) => x?.toLowerCase().includes(s)))
      .sort((a, b) => (a.kind === "VEH" ? 0 : 1) - (b.kind === "VEH" ? 0 : 1) || a.name.localeCompare(b.name, "fr"));
  }, [assets, q]);
  const chosen = assets.find((a) => a.id === asset);

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    setShots((o) => [...o, ...Array.from(files).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };
  const pick = (p: (typeof PRESETS)[number]) => {
    setKind(p);
    setUrgency(p.urgency);
    setImmobilized(!!p.immobilized);
    if (!desc || PRESETS.some((x) => x.label === desc)) setDesc(p.label === "Autre" ? "" : p.label);
  };

  const ready = (asset || label.trim()) && kind && desc.trim();
  const send = async () => {
    if (!ready) return;
    setBusy("Enregistrement…");
    const r = await saveRow("repairs", null, {
      asset_id: asset || null,
      kind: chosen?.kind || "MAN",
      label: chosen ? assetLabel(chosen) : label.trim(),
      category: kind!.category,
      urgency,
      immobilized,
      description: desc.trim(),
      mileage: mileage || null,
      observed_on: iso(today()),
      status: "A",
    });
    if (!r.ok) {
      setBusy(null);
      return void toast.error(r.error);
    }
    const id = r.data!.id;
    const sb = createClient();
    let sent = 0;
    for (const [i, s] of shots.entries()) {
      setBusy(`Envoi des photos ${i + 1}/${shots.length}…`);
      const blob = await compressImage(s.file);
      const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const up = await sb.storage.from("repair-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) {
        toast.error("Une photo n'a pas pu être envoyée : " + up.error.message);
        continue;
      }
      const res = await addRepairPhoto(id, path);
      if (res.ok) sent++;
    }
    toast.success(`Signalement enregistré${sent ? ` avec ${sent} photo(s)` : ""}`, { description: chosen ? assetLabel(chosen) : label });
    router.push(`/reparations/${id}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Signaler un problème" icon={<Camera className="h-6 w-6" />} subtitle="Une photo, le véhicule, le problème : c'est envoyé au suivi des réparations." />

      {/* 1. Photos */}
      <Step n={1} title="Prendre la photo" done={shots.length > 0}>
        <input ref={input} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        {shots.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <AnimatePresence>
              {shots.map((s, i) => (
                <motion.div key={s.url} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative aspect-square overflow-hidden rounded-xl border border-line">
                  <img src={s.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button onClick={() => setShots((o) => o.filter((x) => x !== s))} className="absolute top-1 right-1 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white" aria-label={`Retirer la photo ${i + 1}`}>
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            <button onClick={() => input.current?.click()} className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-line text-muted hover:border-brand/50 hover:text-brand" aria-label="Ajouter une photo">
              <ImagePlus className="h-6 w-6" />
            </button>
          </div>
        ) : (
          <button onClick={() => input.current?.click()} className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/40 bg-brand/5 text-brand transition-colors hover:bg-brand/10 active:scale-[0.99]">
            <Camera className="h-10 w-10" />
            <span className="font-semibold">Ouvrir l&apos;appareil photo</span>
            <span className="text-xs text-muted">ou choisir dans la galerie · facultatif</span>
          </button>
        )}
      </Step>

      {/* 2. Véhicule */}
      <Step n={2} title="Quel véhicule ou matériel ?" done={!!(asset || label.trim())}>
        {chosen ? (
          <button onClick={() => setAsset("")} className="flex w-full items-center gap-3 rounded-xl border border-brand bg-brand/5 p-3 text-left">
            <Truck className="h-5 w-5 text-brand" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{assetLabel(chosen)}</span>
              <span className="text-xs text-muted">{ASSET_KINDS[chosen.kind].label}{chosen.assigned_to ? ` · ${chosen.assigned_to}` : ""}</span>
            </span>
            <span className="text-xs font-semibold text-brand">Changer</span>
          </button>
        ) : (
          <>
            {assets.length > 6 && (
              <div className="relative mb-2">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Immatriculation, nom, chauffeur…" className="pl-9" aria-label="Chercher un véhicule" />
              </div>
            )}
            <div className="grid max-h-72 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {vehicles.map((a) => (
                <button key={a.id} onClick={() => setAsset(a.id)} className="flex min-h-12 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 text-left hover:border-brand/40">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{assetLabel(a)}</span>
                    <span className="text-xs text-muted">{ASSET_KINDS[a.kind].label}</span>
                  </span>
                </button>
              ))}
            </div>
            <Field label="Hors parc (quai, bâtiment, outil…)" className="mt-3">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. : Porte de quai 2" />
            </Field>
          </>
        )}
      </Step>

      {/* 3. Problème */}
      <Step n={3} title="Quel problème ?" done={!!(kind && desc.trim())}>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => pick(p)} className={cn("min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors", kind?.label === p.label ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface hover:border-brand/40")}>
              {p.label}
            </button>
          ))}
        </div>
        {kind && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 grid gap-4">
            <Field label="Description">
              <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex. : pneu avant droit dégonflé, constaté au départ de tournée" />
            </Field>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-ink/85">Urgence</p>
              <div className="grid grid-cols-3 gap-2">
                {URGENCIES.map((u) => (
                  <button key={u} onClick={() => setUrgency(u)} className={cn("min-h-11 rounded-xl border text-sm font-semibold", urgency === u ? (u === "Bloquant" ? "border-bad bg-bad text-white" : u === "Urgent" ? "border-warn bg-warn text-white" : "border-ink bg-ink text-bg") : "border-line bg-surface")}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3 text-sm font-medium">
              <input type="checkbox" checked={immobilized} onChange={(e) => setImmobilized(e.target.checked)} className="h-5 w-5 accent-[var(--color-brand)]" />
              Le véhicule ne peut plus rouler (immobilisé)
            </label>
            <Field label="Kilométrage (facultatif)">
              <Input inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="Ex. : 182 500" />
            </Field>
          </motion.div>
        )}
      </Step>

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 mt-4 lg:bottom-4">
        <Button className="h-14 w-full justify-center rounded-2xl text-base shadow-pop" disabled={!ready || !!busy} loading={!!busy} onClick={send}>
          {busy ? busy : <><Send className="h-5 w-5" /> Envoyer le signalement</>}
        </Button>
      </div>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <Card className="mb-3 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors", done ? "bg-ok text-white" : "bg-surface-2 text-muted")}>{done ? <Check className="h-4 w-4" /> : n}</span>
        <h2 className="text-[17px] font-bold">{title}</h2>
      </div>
      {children}
    </Card>
  );
}
