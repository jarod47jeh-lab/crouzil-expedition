"use client";
import dynamic from "next/dynamic";
import { AnimatePresence } from "motion/react";
import { Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { DepotTiles } from "@/components/depot/overview";
import { SelectionPanel } from "@/components/depot/hero";
import type { Selection } from "@/components/depot/scene";
import { buildVehicles, noteLine, type DepotSummary } from "@/components/depot/summary";
import { forDashboard } from "@/lib/domain/notes";
import { iso, today } from "@/lib/domain/dates";
import type { Asset, DeliveryNote, Repair } from "@/lib/types";

const Scene = dynamic(() => import("@/components/depot/scene"), { ssr: false });

export function DepotView({ assets, repairs, notes }: { assets: Asset[]; repairs: Repair[]; notes: DeliveryNote[] }) {
  const [sel, setSel] = useState<Selection>(null);
  const s: DepotSummary = useMemo(() => {
    const ti = iso(today());
    const vehicles = buildVehicles(assets, repairs, ti);
    const dash = forDashboard(notes);
    const deliv = dash.filter((n) => n.kind !== "recuperation");
    const recup = notes.filter((n) => (n.kind === "recuperation" || n.kind === "les_deux") && n.status !== "done");
    const down = vehicles.filter((v) => v.state === "bad").length;
    const empty = (id: "racks" | "prepa" | "reserve" | "bureau", stat: string) => ({ id, alerts: 0, lines: [], stat });
    return {
      vehicles,
      teams: [],
      zones: {
        quais: { id: "quais", alerts: deliv.filter((n) => n.level === "attention" && n.status === "todo").length, lines: deliv.map(noteLine), stat: `${deliv.length} consigne(s) pour les départs` },
        cour: { id: "cour", alerts: recup.filter((n) => n.status === "todo").length, lines: recup.map(noteLine), stat: "Fûts pleins, vides et reprises" },
        prepa: empty("prepa", "Préparation des commandes"),
        racks: empty("racks", "Allées de racks palettes"),
        reserve: empty("reserve", "Cage alcools forts, accès badgé"),
        bureau: empty("bureau", "Prise de commandes"),
        parking: { id: "parking", alerts: down, lines: [], stat: `${vehicles.length - down}/${vehicles.length} véhicules disponibles` },
      },
    };
  }, [assets, repairs, notes]);
  return (
    <>
      <PageHeader title="Plan du dépôt" icon={<Warehouse className="h-6 w-6" />} subtitle="Ayguesvives · zones, quais et véhicules en direct. Les mesures exactes des racks viendront à l'étape suivante." />
      <div className="relative -mx-4 h-[62dvh] min-h-[380px] overflow-hidden border-y border-line bg-surface-2/40 sm:mx-0 sm:rounded-2xl sm:border">
        <Scene summary={s} selection={sel} onSelect={setSel} />
        <AnimatePresence>{sel && <SelectionPanel s={s} sel={sel} onClose={() => setSel(null)} className="absolute right-3 bottom-3 left-3 z-30 sm:left-auto sm:w-[340px]" />}</AnimatePresence>
      </div>
      <div className="mt-4">
        <DepotTiles s={s} />
      </div>
    </>
  );
}
