"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { DepotSummary, DepotZoneInfo } from "./summary";
import { ZONE_META } from "./overview";

const Scene = dynamic(() => import("./scene"), { ssr: false });

/** Bandeau 3D d'une page : le dépôt cadré sur la zone qui la concerne */
export function DepotBanner({ summary, focus, caption }: { summary: DepotSummary; focus: DepotZoneInfo["id"]; caption?: string }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setOk(!!(c.getContext("webgl2") || c.getContext("webgl")) && !matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      setOk(false);
    }
  }, []);
  if (!ok) return null;
  return (
    <div className="relative mb-5 h-[170px] overflow-hidden rounded-2xl border border-line bg-surface-2/40 sm:h-[220px]">
      <Scene summary={summary} selection={{ type: "zone", id: focus }} onSelect={() => {}} interactive={false} autoRotate />
      <Link href="/depot" className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/90 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:text-brand">
        {caption || ZONE_META[focus].name} · plan du dépôt <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
