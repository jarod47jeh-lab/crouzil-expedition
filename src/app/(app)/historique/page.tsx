import { History } from "lucide-react";
import { AuditItem } from "@/components/app/history";
import { Card, Empty } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getAudit } from "@/lib/data";
import { TABLE_LABELS } from "@/lib/domain/constants";
import { HistoryFilters } from "./filters";

export const metadata = { title: "Historique" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ t?: string; n?: string }> }) {
  const sp = await searchParams;
  const limit = Math.min(1000, Number(sp.n) || 150);
  const entries = await getAudit(undefined, { table: sp.t && TABLE_LABELS[sp.t] ? sp.t : undefined, limit });
  const days = new Map<string, typeof entries>();
  for (const e of entries) {
    const d = new Date(e.at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    days.set(d, [...(days.get(d) || []), e]);
  }
  return (
    <>
      <PageHeader title="Historique" icon={<History className="h-6 w-6" />} subtitle="Toutes les créations, modifications et suppressions, avec leur auteur" />
      <HistoryFilters current={sp.t || ""} limit={limit} />
      {entries.length ? (
        <div className="grid gap-6">
          {[...days.entries()].map(([d, list]) => (
            <Card key={d} className="p-5">
              <h2 className="mb-4 text-sm font-bold text-muted first-letter:uppercase">{d}</h2>
              <ul className="ml-1 grid gap-4 border-l border-line pl-0">
                {list.map((e) => (
                  <AuditItem key={e.id} e={e} showTable />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty icon={<History className="h-5 w-5" />} title="Aucune modification enregistrée" />
        </Card>
      )}
    </>
  );
}
