"use client";
import { CanWrite } from "@/components/app/perms-context";
import Link from "next/link";
import { Building2, Plus, Repeat, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { fmtDate } from "@/lib/domain/dates";
import type { Client } from "@/lib/types";
import { CLIENT_FIELDS } from "./fields";

type Row = Client & { n: number; last: string | null; n90: number };

export function ClientsView({ rows }: { rows: Row[] }) {
  const ed = useEditor<Row>();
  const recurring = rows.filter((r) => r.n90 >= 3);
  return (
    <>
      <PageHeader
        title="Clients"
        icon={<Building2 className="h-6 w-6" />}
        subtitle="Fiches clients, consignes de livraison et historique des erreurs"
        actions={
          <CanWrite module="clients">
          <Button onClick={ed.create}>
            <Plus className="h-4 w-4" /> Nouveau client
          </Button>
          </CanWrite>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi index={0} label="Clients" value={rows.length} icon={<Building2 className="h-5 w-5" />} />
        <Kpi index={1} label="Avec au moins une erreur" value={rows.filter((r) => r.n).length} tone="warn" />
        <Kpi index={2} label="Récurrents (90 j)" value={recurring.length} tone={recurring.length ? "bad" : "ok"} icon={<Repeat className="h-5 w-5" />} sub="3 erreurs ou plus en 90 jours" />
        <Kpi index={3} label="Sans contact renseigné" value={rows.filter((r) => !r.phone && !r.email).length} tone="info" icon={<TriangleAlert className="h-5 w-5" />} />
      </div>
      <DataTable
        rows={rows}
        table="clients"
        exportName="clients"
        onEdit={ed.edit}
        rowHref={(r) => `/clients/${r.id}`}
        searchText={(r) => `${r.name} ${r.contact_name || ""} ${r.route || ""} ${r.phone || ""} ${r.address || ""}`}
        initialSort={{ key: "n", dir: "desc" }}
        filters={[{ key: "s", label: "Suivi", options: [["rec", "Récurrents (90 j)"], ["err", "Avec erreurs"], ["none", "Sans erreur"]], value: (r) => [...(r.n90 >= 3 ? ["rec"] : []), r.n ? "err" : "none"] }]}
        columns={[
          { key: "name", header: "Client", sort: (r) => r.name, cell: (r) => <Link href={`/clients/${r.id}`} className="font-semibold hover:text-brand">{r.name}</Link> },
          { key: "route", header: "Tournée", sort: (r) => r.route, cell: (r) => r.route || <span className="text-muted">–</span>, hideOnMobile: true },
          { key: "contact", header: "Contact", hideOnMobile: true, sort: (r) => r.contact_name, exportValue: (r) => [r.contact_name, r.phone, r.email].filter(Boolean).join(" · "), cell: (r) => <span className="text-muted">{[r.contact_name, r.phone].filter(Boolean).join(" · ") || "–"}</span> },
          { key: "n", header: "Erreurs", className: "text-right", sort: (r) => r.n, cell: (r) => (r.n ? <b>{r.n}</b> : <span className="text-muted">0</span>) },
          { key: "n90", header: "90 jours", className: "text-right", sort: (r) => r.n90, cell: (r) => (r.n90 >= 3 ? <Badge tone="bad">{r.n90}</Badge> : r.n90 || <span className="text-muted">0</span>) },
          { key: "last", header: "Dernière erreur", sort: (r) => r.last || "", exportValue: (r) => fmtDate(r.last), cell: (r) => <span className="tabular">{fmtDate(r.last) || "–"}</span>, hideOnMobile: true },
        ]}
      />
      <EntityForm open={ed.open} onClose={ed.close} title={ed.row ? `Modifier ${ed.row.name}` : "Nouveau client"} table="clients" id={ed.row?.id} initial={ed.row ? { ...ed.row } : {}} fields={CLIENT_FIELDS} />
    </>
  );
}
