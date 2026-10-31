"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TABLE_LABELS } from "@/lib/domain/constants";

export function HistoryFilters({ current, limit }: { current: string; limit: number }) {
  const router = useRouter();
  const go = (t: string, n = limit) => router.push(`/historique?${new URLSearchParams({ ...(t ? { t } : {}), n: String(n) })}`);
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <select value={current} onChange={(e) => go(e.target.value)} className="field h-9 min-h-0 w-auto pr-8 text-sm">
        <option value="">Tous les modules</option>
        {Object.entries(TABLE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <Button variant="ghost" size="sm" onClick={() => go(current, limit + 150)}>
        Charger plus ancien
      </Button>
    </div>
  );
}
