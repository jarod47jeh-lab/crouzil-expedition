"use client";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { destroyRow, purgeTrash, restoreRow } from "@/lib/actions/crud";
import { TABLE_LABELS } from "@/lib/domain/constants";
import { fmtDateTime } from "@/lib/domain/dates";

type Row = { id: string; row_id: string; table_name: string; label: string; deleted_at: string; by: string };

export function TrashView({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const restore = (r: Row) =>
    start(async () => {
      const res = await restoreRow(r.table_name, r.row_id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`« ${r.label} » restauré`);
      router.refresh();
    });
  const destroy = (r: Row) => {
    if (!confirm(`Supprimer définitivement « ${r.label} » ? Cette action est irréversible.`)) return;
    start(async () => {
      const res = await destroyRow(r.table_name, r.row_id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Supprimé définitivement");
      router.refresh();
    });
  };
  const purge = () =>
    start(async () => {
      const res = await purgeTrash();
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${res.data} élément(s) de plus de 30 jours supprimé(s)`);
      router.refresh();
    });
  const left = (d: string) => Math.max(0, 30 - Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
  return (
    <>
      <PageHeader
        title="Corbeille"
        icon={<Trash2 className="h-6 w-6" />}
        subtitle="Les éléments supprimés restent restaurables pendant 30 jours"
        actions={
          <Button variant="outline" onClick={purge} loading={pending}>
            Vider les éléments de plus de 30 jours
          </Button>
        }
      />
      <DataTable
        rows={rows}
        empty="La corbeille est vide"
        searchText={(r) => `${r.label} ${TABLE_LABELS[r.table_name]}`}
        initialSort={{ key: "at", dir: "desc" }}
        filters={[{ key: "t", label: "Module", options: [...new Set(rows.map((r) => r.table_name))].map((t) => [t, TABLE_LABELS[t] || t]), value: (r) => r.table_name }]}
        columns={[
          { key: "t", header: "Module", sort: (r) => TABLE_LABELS[r.table_name], cell: (r) => <Badge tone="info">{TABLE_LABELS[r.table_name] || r.table_name}</Badge> },
          { key: "label", header: "Élément", sort: (r) => r.label, cell: (r) => <b>{r.label}</b> },
          { key: "at", header: "Supprimé le", sort: (r) => r.deleted_at, cell: (r) => <span className="text-muted">{fmtDateTime(r.deleted_at)}{r.by && ` par ${r.by}`}</span> },
          { key: "left", header: "Reste", sort: (r) => left(r.deleted_at), cell: (r) => <Badge tone={left(r.deleted_at) < 5 ? "bad" : "muted"}>{left(r.deleted_at)} j</Badge> },
          {
            key: "act",
            header: "",
            cell: (r) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="secondary" onClick={() => restore(r)} disabled={pending}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => destroy(r)} disabled={pending} title="Supprimer définitivement">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
