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
import { minimalSummary } from "@/components/depot/summary-empty";
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
    return minimalSummary(
      vehicles,
      { quais: deliv.filter((n) => n.level === "attention" && n.status === "todo").length, vide: recup.filter((n) => n.status === "todo").length, parking: down },
      {
        quais: { lines: deliv.map(noteLine), stat: `${deliv.length} consigne(s) pour les départs · 3 rideaux` },
        vide: { lines: recup.map(noteLine), stat: "Retours de fûts et casiers vides" },
        parking: { stat: `${vehicles.length - down}/${vehicles.length} véhicules disponibles` },
        soft: { stat: "Racks 30 m, 3 niveaux, 6 m de haut" },
        vins: { stat: "Racks 30 m, 3 niveaux, 6 m de haut" },
        alcool: { stat: "2 niveaux, 2 m maxi, en cage" },
      },
    );
  }, [assets, repairs, notes]);
  return (
    <>
      <PageHeader title="Plan du dépôt" icon={<Warehouse className="h-6 w-6" />} subtitle="Ayguesvives · zones, quais et véhicules en direct. Racks de 30 m sur 3 niveaux, plafond à 8 m." />
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
