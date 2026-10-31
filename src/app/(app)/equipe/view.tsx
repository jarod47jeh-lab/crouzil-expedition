"use client";
import { Plus, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { TEAMS } from "@/lib/domain/constants";
import type { balances } from "@/lib/domain/conges";
import type { Employee } from "@/lib/types";
import { nf } from "@/lib/utils";
import { EMPLOYEE_FIELDS, employeeInitial } from "./fields";

type Row = Employee & { bal: ReturnType<typeof balances> };

export function EquipeView({ rows, year }: { rows: Row[]; year: number }) {
  const ed = useEditor<Row>();
  const active = rows.filter((r) => r.active);
  return (
    <>
      <PageHeader
        title="Équipe"
        icon={<Users className="h-6 w-6" />}
        subtitle={`Collaborateurs, fonctions et soldes de congés ${year}`}
        actions={
          <Button onClick={ed.create}>
            <Plus className="h-4 w-4" /> Nouveau collaborateur
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi index={0} label="Effectif actif" value={active.length} icon={<Users className="h-5 w-5" />} />
        <Kpi index={1} label="Chauffeurs" value={active.filter((r) => r.team === "chauf" && !r.freelance).length} tone="info" />
        <Kpi index={2} label="Préparateurs" value={active.filter((r) => r.team === "prep").length} tone="violet" />
        <Kpi index={3} label="Freelances" value={active.filter((r) => r.freelance).length} tone="warn" />
      </div>
      <DataTable
        rows={rows}
        table="employees"
        exportName="equipe"
        onEdit={ed.edit}
        rowHref={(r) => `/equipe/${r.id}`}
        searchText={(r) => `${r.name} ${r.job_title || ""} ${r.phone || ""} ${r.email || ""}`}
        initialSort={{ key: "name", dir: "asc" }}
        filters={[
          { key: "team", label: "Équipe", options: Object.entries(TEAMS), value: (r) => r.team },
          { key: "st", label: "Statut", options: [["active", "Actifs"], ["inactive", "Sortis"], ["freelance", "Freelances"]], value: (r) => [r.active ? "active" : "inactive", ...(r.freelance ? ["freelance"] : [])] },
        ]}
        columns={[
          {
            key: "name",
            header: "Nom",
            sort: (r) => r.name,
            cell: (r) => (
              <Link href={`/equipe/${r.id}`} className="flex items-center gap-3 font-semibold hover:text-brand">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-surface-2 text-xs font-bold text-muted">
                  <UserRound className="h-4 w-4" />
                </span>
                {r.name}
              </Link>
            ),
          },
          { key: "job", header: "Fonction", sort: (r) => r.job_title, cell: (r) => <span className="text-muted">{r.job_title}</span>, hideOnMobile: true },
          {
            key: "team",
            header: "Équipe",
            sort: (r) => r.team,
            exportValue: (r) => TEAMS[r.team],
            cell: (r) => (
              <div className="flex gap-1.5">
                <Badge tone={r.team === "prep" ? "violet" : "info"}>{TEAMS[r.team]}</Badge>
                {r.freelance && <Badge tone="warn">Freelance</Badge>}
                {!r.active && <Badge>Sorti</Badge>}
              </div>
            ),
          },
          { key: "cp", header: "CP restants", className: "text-right", sort: (r) => (r.freelance ? null : r.bal.cpLeft), cell: (r) => (r.freelance ? "–" : <b className={r.bal.cpLeft < 0 ? "text-bad" : ""}>{nf(r.bal.cpLeft, 1)}</b>) },
          { key: "rtt", header: "RTT restants", className: "text-right", hideOnMobile: true, sort: (r) => (r.freelance ? null : r.bal.rttLeft), cell: (r) => (r.freelance ? "–" : nf(r.bal.rttLeft, 1)) },
          { key: "phone", header: "Téléphone", hideOnMobile: true, sort: (r) => r.phone, cell: (r) => (r.phone ? <a href={`tel:${r.phone}`} className="hover:text-brand">{r.phone}</a> : <span className="text-muted">–</span>) },
        ]}
      />
      <EntityForm
        open={ed.open}
        onClose={ed.close}
        title={ed.row ? `Modifier ${ed.row.name}` : "Nouveau collaborateur"}
        table="employees"
        id={ed.row?.id}
        initial={employeeInitial(ed.row)}
        fields={EMPLOYEE_FIELDS}
      />
    </>
  );
}
