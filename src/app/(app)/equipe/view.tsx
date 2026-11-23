"use client";
import { Avatar } from "@/components/ui/avatar";
import { CanWrite, usePerms } from "@/components/app/perms-context";
import { AvatarStudio } from "@/components/app/avatar-picker";
import { TeamExportButton } from "@/components/app/export-buttons";
import { useState } from "react";
import { LayoutGrid, List, Phone, Plus, Search, Smile, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { TEAM_ORDER, TEAM_TONE, TEAMS } from "@/lib/domain/constants";
import type { balances } from "@/lib/domain/conges";
import type { DayMark, Employee, LeaveRequest, Qualification, QualificationType } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { absencesOn } from "@/lib/domain/conges";
import { LEAVE_COLOR, LEAVE_LABEL } from "@/lib/domain/constants";
import { iso, today } from "@/lib/domain/dates";
import { appliesTo, qualStatus } from "@/lib/domain/qualifications";
import { ZONE_META } from "@/components/depot/overview";
import { zoneOfEmployee } from "@/components/depot/summary";
import { TEAM_SHIRT } from "@/lib/domain/avatar";
import { cn, plural } from "@/lib/utils";
import { nf } from "@/lib/utils";
import { EMPLOYEE_FIELDS, employeeInitial } from "./fields";

type Row = Employee & { bal: ReturnType<typeof balances> };

export function EquipeView({ rows, year, qualTypes = [], quals = [], leaves = [], marks = [] }: { rows: Row[]; year: number; qualTypes?: QualificationType[]; quals?: Qualification[]; leaves?: LeaveRequest[]; marks?: DayMark[] }) {
  const ed = useEditor<Row>();
  const active = rows.filter((r) => r.active);
  const [mode, setMode] = useState<"fiches" | "tableau">("fiches");
  const [q, setQ] = useState("");
  const [team, setTeam] = useState<string>("all");
  const [st, setSt] = useState<"active" | "inactive" | "freelance" | "alert" | "all">("active");
  const t = iso(today());
  const absent = new Map(absencesOn(today(), leaves, marks).map((a) => [a.employee_id, a.type]));
  const alertsOf = (e: Row) => qualTypes.filter((ty) => appliesTo(ty, e.team)).filter((ty) => ["soon", "expired", "missing"].includes(qualStatus(ty, e, quals, t).state)).length;
  const shown = rows.filter((r) => {
    const txt = `${r.name} ${r.job_title || ""} ${r.phone || ""}`.toLowerCase();
    if (q.trim() && !txt.includes(q.trim().toLowerCase())) return false;
    if (team !== "all" && r.team !== team) return false;
    if (st === "active") return r.active;
    if (st === "inactive") return !r.active;
    if (st === "freelance") return r.freelance && r.active;
    if (st === "alert") return r.active && alertsOf(r) > 0;
    return true;
  });
  const perms = usePerms();
  const [studio, setStudio] = useState(false);
  return (
    <>
      <PageHeader
        title="Équipe"
        icon={<Users className="h-6 w-6" />}
        subtitle={`Collaborateurs, fonctions et soldes de congés ${year}`}
        actions={
          <>
            <TeamExportButton />
            {perms.admin && (
              <Button variant="outline" onClick={() => setStudio(true)}>
                <Smile className="h-4 w-4" /> Avatars
              </Button>
            )}
            <CanWrite module="equipe">
              <Button onClick={ed.create}>
                <Plus className="h-4 w-4" /> Nouveau collaborateur
              </Button>
            </CanWrite>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi index={0} label="Effectif actif" value={active.length} icon={<Users className="h-5 w-5" />} />
        <Kpi index={1} label="Chauffeurs et préparateurs" value={active.filter((r) => (r.team === "chauf" || r.team === "prep") && !r.freelance).length} tone="info" />
        <Kpi index={2} label="Responsables, commande et direction" value={active.filter((r) => r.team === "resp" || r.team === "commande" || r.team === "bureau").length} tone="violet" />
        <Kpi index={3} label="Freelances" value={active.filter((r) => r.freelance).length} tone="warn" />
      </div>
      <Card className="mb-5 flex flex-wrap items-center gap-2 p-3">
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, fonction, téléphone" className="field h-9 min-h-0 w-56 pl-8 text-sm" aria-label="Rechercher un collaborateur" />
        </label>
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {["all", ...TEAM_ORDER].map((g) => (
            <button key={g} type="button" onClick={() => setTeam(g)} aria-pressed={team === g} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold", team === g ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink")}>
              {g === "all" ? "Toutes les équipes" : TEAMS[g as keyof typeof TEAMS]}
            </button>
          ))}
        </div>
        <select value={st} onChange={(e) => setSt(e.target.value as typeof st)} className="field h-9 min-h-0 w-auto pr-8 text-sm" aria-label="Statut">
          <option value="active">Actifs</option>
          <option value="freelance">Freelances</option>
          <option value="alert">Qualifications à traiter</option>
          <option value="inactive">Sortis de l&apos;équipe</option>
          <option value="all">Tous</option>
        </select>
        <div className="ml-auto flex rounded-xl border border-line p-0.5">
          <button type="button" onClick={() => setMode("fiches")} aria-pressed={mode === "fiches"} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold", mode === "fiches" ? "bg-surface-2 text-ink" : "text-muted")}>
            <LayoutGrid className="h-4 w-4" /> Fiches
          </button>
          <button type="button" onClick={() => setMode("tableau")} aria-pressed={mode === "tableau"} className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold", mode === "tableau" ? "bg-surface-2 text-ink" : "text-muted")}>
            <List className="h-4 w-4" /> Tableau
          </button>
        </div>
      </Card>
      {mode === "fiches" && (
        <div className="grid gap-7">
          {TEAM_ORDER.map((g) => {
            const list = shown.filter((r) => r.team === g).sort((x, y) => x.name.localeCompare(y.name, "fr"));
            if (!list.length) return null;
            const here = list.filter((r) => r.active && !absent.has(r.id)).length;
            return (
              <section key={g}>
                <div className="mb-3 flex items-baseline gap-3 border-b-2 pb-1.5" style={{ borderColor: TEAM_SHIRT[g] }}>
                  <h2 className="font-display text-lg font-medium">{TEAMS[g]}</h2>
                  <span className="text-sm text-muted">{plural(list.length, "collaborateur")} · {plural(here, "présent")} aujourd&apos;hui</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {list.map((r) => {
                    const abs = absent.get(r.id);
                    const al = alertsOf(r);
                    return (
                      <Link key={r.id} href={`/equipe/${r.id}`} className={cn("group relative flex gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-3.5 transition-[color,background-color,border-color,opacity,transform] hover:border-brand/40", !r.active && "opacity-60")}>
                        <span className="absolute inset-y-0 left-0 w-1" style={{ background: TEAM_SHIRT[r.team] }} />
                        <Avatar e={r} size={58} dim={!!abs} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-base leading-tight font-medium group-hover:text-brand">{r.name}</p>
                          <p className="truncate text-[13px] text-muted">{r.job_title || TEAMS[r.team]} · {ZONE_META[zoneOfEmployee(r)].name}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {abs ? <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: LEAVE_COLOR[abs] }}>{LEAVE_LABEL[abs]}</span> : r.active && <Badge tone="ok">Présent</Badge>}
                            {r.freelance && <Badge tone="warn">Freelance</Badge>}
                            {!r.active && <Badge>Sorti</Badge>}
                            {al > 0 && <Badge tone="bad">{al} qualif. à traiter</Badge>}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                            {r.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span> : <span />}
                            {!r.freelance && <span>CP <b className={r.bal.cpLeft < 0 ? "text-bad" : "text-ink"}>{nf(r.bal.cpLeft, 1)}</b></span>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {!shown.length && <Card className="p-8 text-center text-muted">Aucun collaborateur ne correspond à ces filtres.</Card>}
        </div>
      )}
      {mode === "tableau" && (
      <DataTable
        rows={shown}
        table="employees"
        exportName="equipe"
        onEdit={ed.edit}
        rowHref={(r) => `/equipe/${r.id}`}
        searchText={(r) => `${r.name} ${r.job_title || ""} ${r.phone || ""} ${r.email || ""}`}
        initialSort={{ key: "name", dir: "asc" }}
        filters={[
          { key: "team", label: "Équipe", options: TEAM_ORDER.map((k) => [k, TEAMS[k]]), value: (r) => r.team },
          { key: "st", label: "Statut", options: [["active", "Actifs"], ["inactive", "Sortis"], ["freelance", "Freelances"]], value: (r) => [r.active ? "active" : "inactive", ...(r.freelance ? ["freelance"] : [])] },
        ]}
        columns={[
          {
            key: "name",
            header: "Nom",
            sort: (r) => r.name,
            cell: (r) => (
              <Link href={`/equipe/${r.id}`} className="flex items-center gap-3 font-semibold hover:text-brand">
                <Avatar e={r} size={34} />
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
                <Badge tone={TEAM_TONE[r.team]}>{TEAMS[r.team]}</Badge>
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
      )}
      <EntityForm
        open={ed.open}
        onClose={ed.close}
        title={ed.row ? `Modifier ${ed.row.name}` : "Nouveau collaborateur"}
        table="employees"
        id={ed.row?.id}
        initial={employeeInitial(ed.row)}
        fields={EMPLOYEE_FIELDS}
      />
      {perms.admin && <AvatarStudio employees={rows} open={studio} onClose={() => setStudio(false)} />}
    </>
  );
}
