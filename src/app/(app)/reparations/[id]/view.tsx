"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Camera, Check, ImagePlus, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { HistoryCardClient } from "@/components/app/history-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { useEditor } from "@/components/ui/entity-form";
import { PageHeader } from "@/components/ui/page-header";
import { addRepairPhoto, removeRepairPhoto, saveRow, trashRows } from "@/lib/actions/crud";
import { ASSET_KINDS, REPAIR_STATUS, URGENCY_TONE } from "@/lib/domain/constants";
import { daysBetween, fmtDate } from "@/lib/domain/dates";
import { createClient } from "@/lib/supabase/client";
import type { Asset, AuditEntry, Repair, RepairStatus } from "@/lib/types";
import { cn, nf } from "@/lib/utils";
import { RepairForm } from "../shared";

const FLOW: RepairStatus[] = ["A", "T", "V", "R", "F"];

async function compress(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const img = await createImageBitmap(file);
  const max = 1600, s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b || file), "image/jpeg", 0.82));
}

export function RepairDetail({ repair: r, assets, audit, photos }: { repair: Repair; assets: Asset[]; audit: AuditEntry[]; photos: { id: string; path: string; url: string }[] }) {
  const router = useRouter();
  const ed = useEditor<Repair>();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const asset = assets.find((a) => a.id === r.asset_id);
  const age = daysBetween(r.observed_on);

  const setStatus = (s: RepairStatus) =>
    start(async () => {
      const res = await saveRow("repairs", r.id, { status: s, ...(s === "F" || s === "X" ? { closed_on: new Date().toISOString().slice(0, 10) } : { closed_on: null }) });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Statut : ${REPAIR_STATUS[s].label}`);
      router.refresh();
    });

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const sb = createClient();
    for (const f of Array.from(files)) {
      const blob = await compress(f);
      const path = `${r.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await sb.storage.from("repair-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) {
        toast.error("Envoi impossible : " + error.message);
        continue;
      }
      const res = await addRepairPhoto(r.id, path);
      if (!res.ok) toast.error(res.error);
    }
    setUploading(false);
    toast.success("Photo(s) ajoutée(s)");
    router.refresh();
  };

  const remove = () =>
    start(async () => {
      const res = await trashRows("repairs", [r.id]);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Demande mise à la corbeille");
      router.push("/reparations?tab=list");
    });

  const idx = FLOW.indexOf(r.status);
  return (
    <>
      <Link href="/reparations?tab=list" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Réparations
      </Link>
      <PageHeader
        title={r.label}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {ASSET_KINDS[r.kind].label} · {r.category}
            {r.immobilized && <Badge tone="bad">Immobilisé</Badge>}
            <Badge tone={URGENCY_TONE[r.urgency]}>{r.urgency}</Badge>
          </span>
        }
        actions={
          <>
            <Button variant="danger" onClick={remove} loading={pending}>
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
            <Button onClick={() => ed.edit(r)}>
              <Pencil className="h-4 w-4" /> Modifier
            </Button>
          </>
        }
      />

      <Card className="mb-6 p-5">
        <p className="mb-4 text-sm font-semibold text-muted">Avancement</p>
        <div className="flex flex-wrap items-center gap-y-3">
          {FLOW.map((s, i) => {
            const done = r.status !== "X" && i <= idx;
            return (
              <div key={s} className="flex items-center">
                <button
                  onClick={() => setStatus(s)}
                  disabled={pending || s === r.status}
                  className={cn(
                    "group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all",
                    s === r.status ? "border-brand bg-brand text-brand-ink shadow" : done ? "border-brand/30 bg-brand/10 text-brand" : "border-line text-muted hover:border-brand/40 hover:text-ink",
                  )}
                >
                  <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[11px]", s === r.status ? "bg-white/25" : done ? "bg-brand/20" : "bg-surface-2")}>
                    {done && s !== r.status ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {REPAIR_STATUS[s].label}
                </button>
                {i < FLOW.length - 1 && <motion.span className={cn("mx-1 h-[2px] w-6 rounded sm:w-10", i < idx && r.status !== "X" ? "bg-brand/50" : "bg-line")} />}
              </div>
            );
          })}
          <button
            onClick={() => setStatus("X")}
            disabled={pending || r.status === "X"}
            className={cn("ml-3 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold", r.status === "X" ? "border-ink bg-ink text-surface" : "border-line text-muted hover:text-bad")}
          >
            <X className="h-3.5 w-3.5" /> Refusé
          </button>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader title="Problème" />
            <div className="grid gap-4 px-5 pb-5">
              <p className="whitespace-pre-wrap">{r.description || <span className="text-muted">Pas de description.</span>}</p>
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                {[
                  ["Constaté le", `${fmtDate(r.observed_on)} (${age <= 0 ? "aujourd'hui" : `il y a ${age} j`})`],
                  ["Retour prévu", fmtDate(r.expected_back) || "–"],
                  ["Kilométrage", r.mileage || "–"],
                  ["Coût", r.cost ? `${nf(Number(r.cost), 2)} € HT` : "–"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs font-semibold text-muted uppercase">{k}</dt>
                    <dd className="mt-0.5 font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              {r.note && (
                <div className="rounded-xl bg-surface-2 p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold text-muted uppercase">Suivi</p>
                  <p className="whitespace-pre-wrap">{r.note}</p>
                </div>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Photos"
              subtitle={`${photos.length} photo(s)`}
              actions={
                <>
                  <input ref={input} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => upload(e.target.files)} />
                  <Button variant="outline" size="sm" onClick={() => input.current?.click()} loading={uploading}>
                    {uploading ? null : <ImagePlus className="h-4 w-4" />} Ajouter
                  </Button>
                </>
              }
            />
            {photos.length ? (
              <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((p) => (
                  <motion.div key={p.id} layout className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="h-full w-full cursor-zoom-in object-cover transition-transform group-hover:scale-105" onClick={() => setZoom(p.url)} />
                    <button
                      onClick={() => start(async () => { await removeRepairPhoto(p.id, p.path, r.id); router.refresh(); })}
                      className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-lg bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Supprimer la photo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Empty icon={uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />} title="Aucune photo">
                Sur téléphone, « Ajouter » ouvre directement l&apos;appareil photo.
              </Empty>
            )}
          </Card>
        </div>
        <div className="grid min-w-0 content-start gap-6">
          {asset && (
            <Card>
              <CardHeader title={asset.name} subtitle={ASSET_KINDS[asset.kind].label} actions={<Link href={`/parc/${asset.id}`} className="text-sm font-semibold text-brand">Voir la fiche</Link>} />
              <dl className="grid grid-cols-2 gap-3 px-5 pb-5 text-sm">
                {[
                  ["Immatriculation / réf.", asset.ref],
                  ["Désignation", asset.designation],
                  ["Marque", [asset.brand, asset.model].filter(Boolean).join(" ")],
                  ["Affecté à", asset.assigned_to],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd className="font-medium">{v || "–"}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
          <HistoryCardClient entries={audit} />
        </div>
      </div>
      <AnimatePresence>
        {zoom && (
          <motion.div className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/80 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(null)}>
            <motion.img src={zoom} alt="" className="max-h-full max-w-full rounded-xl" initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }} />
          </motion.div>
        )}
      </AnimatePresence>
      <RepairForm open={ed.open} onClose={ed.close} row={ed.row} assets={assets} />
    </>
  );
}
