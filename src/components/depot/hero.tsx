"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ZONE_META } from "./overview";
import type { Selection } from "./scene";
import type { DepotSummary } from "./summary";

const Scene = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => <Loading />,
});

function Loading() {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand" /> Chargement du dépôt…
      </div>
    </div>
  );
}

function canWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const TONE = { ok: "ok", warn: "warn", bad: "bad" } as const;
const STATE_LABEL = { ok: "Disponible", warn: "À surveiller", bad: "Immobilisé" };

/** Fiche de la zone ou du véhicule sélectionné */
export function SelectionPanel({ s, sel, onClose, className }: { s: DepotSummary; sel: Selection; onClose: () => void; className?: string }) {
  if (!sel) return null;
  if (sel.type === "vehicle") {
    const v = s.vehicles.find((x) => x.id === sel.id);
    if (!v) return null;
    return (
      <Panel className={className} onClose={onClose} kick="Véhicule" title={v.name} sub={[v.plate, v.kind].filter(Boolean).join(" · ")}>
        <ul className="grid gap-1.5">
          <li className="flex items-center gap-2 rounded-xl border border-line p-2.5 text-sm">
            <Badge tone={TONE[v.state]}>{STATE_LABEL[v.state]}</Badge>
            <span className="min-w-0 truncate">{v.note}</span>
          </li>
          {v.driver && (
            <li className="flex items-center gap-2 rounded-xl border border-line p-2.5 text-sm">
              <Badge tone="muted">Attribué à</Badge>
              {v.driver}
            </li>
          )}
        </ul>
        <Link href={`/parc/${v.id}`} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand text-sm font-semibold text-brand-ink">
          Ouvrir la fiche du véhicule <ArrowRight className="h-4 w-4" />
        </Link>
      </Panel>
    );
  }
  const z = s.zones[sel.id], m = ZONE_META[sel.id];
  const lines = sel.id === "parking" ? s.vehicles.map((v) => ({ text: `${v.name}${v.plate ? " · " + v.plate : ""}`, sub: v.note, tone: v.state })) : z.lines;
  return (
    <Panel className={className} onClose={onClose} kick={m.kick} title={m.name} sub={z.stat}>
      {lines.length ? (
        <ul className="grid max-h-56 gap-1.5 overflow-y-auto">
          {lines.map((l, i) => (
            <li key={i} className="flex items-start gap-2 rounded-xl border border-line p-2.5 text-sm">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", l.tone === "bad" ? "bg-bad" : l.tone === "warn" ? "bg-warn" : "bg-ok")} />
              <span className="min-w-0">
                <span className="line-clamp-2">{l.text}</span>
                {l.sub && <span className="block text-xs text-muted">{l.sub}</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Rien à signaler dans cette zone.</p>
      )}
      <Link href={m.href} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand text-sm font-semibold text-brand-ink">
        Ouvrir <ArrowRight className="h-4 w-4" />
      </Link>
    </Panel>
  );
}

function Panel({ kick, title, sub, children, onClose, className }: { kick: string; title: string; sub?: string; children: React.ReactNode; onClose: () => void; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      className={cn("grid gap-3 rounded-2xl border border-line bg-surface/95 p-4 shadow-pop backdrop-blur", className)}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-[0.09em] text-brand uppercase">{kick}</p>
          <p className="font-display text-lg leading-tight font-bold">{title}</p>
          {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
        </div>
        <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line hover:bg-surface-2" aria-label="Fermer la fiche">
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </motion.div>
  );
}

/** Le dépôt en 3D, encadré dans une carte (accueil) */
export function DepotHero({ summary, className }: { summary: DepotSummary; className?: string }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const [sel, setSel] = useState<Selection>(null);
  useEffect(() => setOk(canWebGL()), []);
  if (ok === false) return null;
  return (
    <div className={cn("relative h-[300px] sm:h-[380px] xl:h-[420px]", className)}>
      {ok && <Scene summary={summary} selection={sel} onSelect={setSel} />}
      <AnimatePresence>{sel && <SelectionPanel s={summary} sel={sel} onClose={() => setSel(null)} className="absolute right-3 bottom-3 left-3 z-30 sm:left-auto sm:w-[320px]" />}</AnimatePresence>
      <p className="pointer-events-none absolute top-2 left-4 text-[11px] text-muted">Glissez pour tourner · touchez une zone</p>
    </div>
  );
}
