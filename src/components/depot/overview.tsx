"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Box, Building, Container, Droplet, GlassWater, PackageOpen, ParkingSquare, Recycle, ShieldCheck, Trees, Warehouse, Wine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DepotSummary, ZoneId } from "./summary";

export const ZONE_META: Record<ZoneId, { name: string; kick: string; icon: typeof Box; href: string }> = {
  quais: { name: "Quais", kick: "3 rideaux de chargement", icon: Container, href: "/remontees" },
  parking: { name: "Véhicules", kick: "Stationnement de la flotte", icon: ParkingSquare, href: "/parc" },
  depose: { name: "Dépose commandes", kick: "Commandes préparées", icon: Box, href: "/erreurs" },
  soft: { name: "Soft", kick: "Racks 3 niveaux, 6 m", icon: Warehouse, href: "/journal" },
  vins: { name: "Vins", kick: "Racks 3 niveaux, 6 m", icon: Wine, href: "/journal" },
  sirop: { name: "Sirop", kick: "Étagères de picking", icon: Droplet, href: "/journal" },
  alcool: { name: "Alcool", kick: "2 niveaux, 2 m max", icon: ShieldCheck, href: "/taches" },
  futs: { name: "Fûts", kick: "Fûts pleins", icon: PackageOpen, href: "/remontees" },
  patio: { name: "Patio", kick: "Entre fûts et soft", icon: Trees, href: "/remontees" },
  verres: { name: "Verres et fûts", kick: "Verres et fûts", icon: GlassWater, href: "/journal" },
  bureau: { name: "Bureau téléachat", kick: "Service Commande", icon: Building, href: "/conges" },
  vide: { name: "Vides", kick: "Retours et vides", icon: Recycle, href: "/remontees" },
};
const TONE = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" };

/** Résumé du dépôt en tuiles : version légère, et liste accessible sous la vue 3D */
export function DepotTiles({ s, compact }: { s: DepotSummary; compact?: boolean }) {
  const order: ZoneId[] = ["quais", "parking", "depose", "futs", "soft", "vins", "sirop", "alcool", "verres", "patio", "bureau", "vide"];
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
