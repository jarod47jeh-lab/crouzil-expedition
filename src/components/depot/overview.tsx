"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Box, Building, Container, PackageOpen, ParkingSquare, ShieldCheck, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DepotSummary, DepotZoneInfo } from "./summary";

export const ZONE_META: Record<DepotZoneInfo["id"], { name: string; kick: string; icon: typeof Box; href: string }> = {
  quais: { name: "Quais de chargement", kick: "Départs et consignes", icon: Container, href: "/remontees" },
  cour: { name: "Cour à fûts", kick: "Pleins, vides, reprises", icon: PackageOpen, href: "/remontees" },
  racks: { name: "Entrepôt racks", kick: "Stockage palettes", icon: Warehouse, href: "/journal" },
  prepa: { name: "Zone préparation", kick: "Préparateurs et erreurs", icon: Box, href: "/erreurs" },
  reserve: { name: "Réserve spiritueux", kick: "Zone sécurisée", icon: ShieldCheck, href: "/taches" },
  bureau: { name: "Bureau télévente", kick: "Service Commande", icon: Building, href: "/conges" },
  parking: { name: "Parking camions", kick: "Flotte", icon: ParkingSquare, href: "/parc" },
};
const TONE = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" };

/** Résumé du dépôt en tuiles : version légère, et liste accessible sous la vue 3D */
export function DepotTiles({ s, compact }: { s: DepotSummary; compact?: boolean }) {
  const order: DepotZoneInfo["id"][] = ["quais", "parking", "cour", "prepa", "racks", "bureau", "reserve"];
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-2 md:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-3")}>
      {order.map((id, i) => {
        const z = s.zones[id], m = ZONE_META[id];
        const first = z.lines[0];
        return (
          <motion.div key={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Link href={m.href} className={cn("group flex h-full items-start rounded-xl border border-line bg-surface transition-colors hover:border-brand/40", compact ? "gap-2 p-2" : "gap-3 p-3")}>
              <span className={cn("grid shrink-0 place-items-center rounded-xl", compact ? "h-7 w-7" : "h-9 w-9", z.alerts ? "bg-bad/10 text-bad" : "bg-navy/10 text-navy")}>
                <m.icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cn("font-semibold", compact ? "text-[12px] leading-tight" : "truncate text-[13.5px]")}>{m.name}</span>
                  {z.alerts > 0 && <span className="rounded-full bg-bad px-1.5 text-[10px] leading-4 font-bold text-white">{z.alerts}</span>}
                </span>
                {!compact && (
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    {first && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE[first.tone])} />}
                    <span className="truncate">{first ? first.text : z.stat || m.kick}</span>
                  </span>
                )}
              </span>
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
