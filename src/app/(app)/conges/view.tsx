"use client";
import { CanWrite, usePerms } from "@/components/app/perms-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { AlertTriangle, CalendarCheck2, Check, ChevronLeft, ChevronRight, Paintbrush, Plus, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Bars, Donut, Legend } from "@/components/charts/charts";
import { Badge, ColorBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { useEditor, useOpenOnNew } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { decideLeave, setDayMarks, setFreelanceCall } from "@/lib/actions/crud";
import { LEAVE_COLOR, LEAVE_LABEL, LEAVE_STATUS, LEAVE_TYPES, TEAM_ORDER, TEAMS, teamMax } from "@/lib/domain/constants";
import { absencesOn, balances, requestDays } from "@/lib/domain/conges";
import { DAYS_SHORT, MONTHS, addDays, fmtDate, fmtLong, isHoliday, isWorkDay, iso, nextWorkDay, parse, prevWorkDay, today } from "@/lib/domain/dates";
import type { DayMark, Employee, FreelanceCall, LeaveRequest, LeaveType, Settings, Team } from "@/lib/types";
import { cn, nf } from "@/lib/utils";
import { LeaveForm } from "./leave-form";

interface Props {
  tab: string;
  day: string;
  year: number;
  month: number;
  employees: Employee[];
  leaves: LeaveRequest[];
  marks: DayMark[];
  calls: FreelanceCall[];
  settings: Settings;
}

export function CongesView(p: Props) {
  const leave = useEditor<LeaveRequest>();
  useOpenOnNew(leave.create);
  const pending = p.leaves.filter((r) => r.status === "pending");
  const q = (o: Record<string, string | number>) => "/conges?" + new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString();
  return (
    <>
      <PageHeader
        title="Présences et congés"
        icon={<CalendarCheck2 className="h-6 w-6" />}
        subtitle="Qui est là, planning, demandes et soldes"
        actions={
          <CanWrite module="conges">
          <Button onClick={leave.create}>
            <Plus className="h-4 w-4" /> Nouvelle demande
          </Button>
          </CanWrite>
        }
      />
      <Tabs
        id="conges-tabs"
        active={p.tab}
        tabs={[
          { key: "jour", label: "Journalier", href: q({ tab: "jour", d: p.day }) },
          { key: "planning", label: "Planning", href: q({ tab: "planning", y: p.year, m: p.month }) },
          { key: "demandes", label: "Demandes", href: q({ tab: "demandes", y: p.year }), count: pending.length },
          { key: "soldes", label: "Soldes et statistiques", href: q({ tab: "soldes", y: p.year }) },
        ]}
      />
      {p.tab === "jour" && <DayTab {...p} />}
      {p.tab === "planning" && <PlanningTab {...p} />}
      {p.tab === "demandes" && <RequestsTab {...p} onEdit={leave.edit} />}
      {p.tab === "soldes" && <BalancesTab {...p} />}
      <LeaveForm open={leave.open} onClose={leave.close} row={leave.row} employees={p.employees} requests={p.leaves} defaultDate={p.day} />
    </>
  );
}

// ---------------------------------------------------------------------
// Journalier
// ---------------------------------------------------------------------
function DayTab({ day, employees, leaves, marks, calls, settings }: Props) {
  const router = useRouter();
  const canEdit = usePerms().write("conges");
  const [busy, start] = useTransition();
  const d = parse(day);
  const team = employees.filter((e) => e.active);
  const abs = useMemo(() => absencesOn(d, leaves, marks, true), [d, leaves, marks]);
  const absOf = (id: string) => abs.find((a) => a.employee_id === id);
  const go = (x: Date) => router.push(`/conges?tab=jour&d=${iso(x)}`, { scroll: false });

  const setMark = (emp: string, type: string) =>
    start(async () => {
      const res = await setDayMarks(emp, [day], type);
      if (!res.ok) toast.error(res.error);
      else toast.success("Planning mis à jour");
      router.refresh();
    });
  const toggleCall = (emp: string, on: boolean) =>
    start(async () => {
      const res = await setFreelanceCall(emp, day, on);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });

  const groups: Team[] = [...TEAM_ORDER];
  return (
    <div className="grid gap-6">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <Button variant="outline" size="icon" onClick={() => go(prevWorkDay(d))} aria-label="Jour précédent">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <input type="date" value={day} onChange={(e) => e.target.value && go(parse(e.target.value))} className="field h-9 min-h-0 w-auto" />
        <Button variant="outline" size="icon" onClick={() => go(nextWorkDay(d))} aria-label="Jour suivant">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <p className="font-display text-lg font-bold">{fmtLong(d)}</p>
        {!isWorkDay(d) && <Badge tone="warn">{isHoliday(d) ? "Jour férié" : "Week-end"}</Badge>}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => go(isWorkDay(today()) ? today() : nextWorkDay(today()))}>
          Aujourd&apos;hui
        </Button>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((g) => {
          const fixed = team.filter((e) => e.team === g && !e.freelance);
          const free = team.filter((e) => e.team === g && e.freelance);
          const nAbs = fixed.filter((e) => absOf(e.id) && !absOf(e.id)!.pending).length;
          const max = teamMax(g, settings);
          if (!fixed.length && !free.length) return null;
          return (
            <Card key={g}>
              <CardHeader
                title={TEAMS[g]}
                subtitle={`${fixed.length - nAbs} présent(s) sur ${fixed.length}`}
                actions={max != null && nAbs > max ? <Badge tone="bad"><AlertTriangle className="h-3.5 w-3.5" /> {nAbs} absents, seuil {max}</Badge> : <Badge tone="ok">{nAbs} absent(s)</Badge>}
              />
              <ul className="divide-y divide-line">
                {fixed.map((e, i) => {
                  const a = absOf(e.id);
                  return (
                    <motion.li
                      key={e.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5"
                    >
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", a ? (a.pending ? "bg-warn" : "bg-bad") : "bg-ok")} />
                      <Link href={`/equipe/${e.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand">
                        {e.name}
                      </Link>
                      {a && (a.pending ? <Badge tone="warn">En attente : {LEAVE_LABEL[a.type]}</Badge> : <ColorBadge color={LEAVE_COLOR[a.type]}>{LEAVE_LABEL[a.type]}</ColorBadge>)}
                      {canEdit && <select
                        disabled={busy}
                        aria-label={`Statut de ${e.name}`}
                        value=""
                        onChange={(ev) => ev.target.value && setMark(e.id, ev.target.value)}
                        className="field h-8 min-h-0 w-[118px] pr-6 text-xs"
                      >
                        <option value="">Modifier…</option>
                        <option value="PRES">Présent</option>
                        {LEAVE_TYPES.map((t) => (
                          <option key={t.k} value={t.k}>
                            {t.label}
                          </option>
                        ))}
                        <option value="CLEAR">Annuler la saisie du jour</option>
                      </select>}
                    </motion.li>
                  );
                })}
                {free.map((e) => {
                  const on = calls.some((c) => c.employee_id === e.id && c.date === day && c.triggered);
                  return (
                    <li key={e.id} className="flex items-center gap-3 bg-surface-2/40 px-5 py-2.5">
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", on ? "bg-ok" : "bg-line")} />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {e.name} <span className="text-xs text-muted">(freelance)</span>
                      </span>
                      <Button size="sm" variant={on ? "primary" : "outline"} disabled={busy || !canEdit} onClick={() => toggleCall(e.id, !on)}>
                        {on ? <><Check className="h-3.5 w-3.5" /> Déclenché</> : "Pas déclenché"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Planning mensuel
// ---------------------------------------------------------------------
function PlanningTab({ year, month, employees, leaves, marks, calls, settings }: Props) {
  const router = useRouter();
  const canEdit = usePerms().write("conges");
  const [brush, setBrush] = useState<string | null>(null);
  const [, start] = useTransition();
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const days = useMemo(() => {
    const n = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => new Date(year, month, i + 1));
  }, [year, month]);
  const team = employees.filter((e) => e.active);
  const go = (y: number, m: number) => {
    if (m < 0) [y, m] = [y - 1, 11];
    if (m > 11) [y, m] = [y + 1, 0];
    router.push(`/conges?tab=planning&y=${y}&m=${m}`, { scroll: false });
  };
  const cellOf = (e: Employee, d: Date) => {
    const k = `${e.id}|${iso(d)}`;
    if (optimistic[k]) return optimistic[k] === "PRES" || optimistic[k] === "CLEAR" ? null : { type: optimistic[k] as LeaveType, pending: false };
    return absencesOn(d, leaves.filter((r) => r.employee_id === e.id), marks.filter((m) => m.employee_id === e.id), true)[0] || null;
  };
  const paint = (e: Employee, d: Date) => {
    if (!brush || e.freelance || !isWorkDay(d)) return;
    const k = `${e.id}|${iso(d)}`;
    setOptimistic((o) => ({ ...o, [k]: brush }));
    start(async () => {
      const res = await setDayMarks(e.id, [iso(d)], brush);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  };
  const absentCount = (d: Date, g: Team) =>
    team.filter((e) => e.team === g && !e.freelance).filter((e) => {
      const c = cellOf(e, d);
      return c && !c.pending;
    }).length;

  return (
    <div className="grid gap-4">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <Button variant="outline" size="icon" onClick={() => go(year, month - 1)} aria-label="Mois précédent">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="min-w-[150px] text-center font-display text-lg font-bold">
          {MONTHS[month]} {year}
        </p>
        <Button variant="outline" size="icon" onClick={() => go(year, month + 1)} aria-label="Mois suivant">
          <ChevronRight className="h-4 w-4" />
        </Button>
        {canEdit && <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Paintbrush className="h-3.5 w-3.5" /> Saisie rapide :
          </span>
          {[["PRES", "Présent", "var(--line)"] as const, ...LEAVE_TYPES.map((t) => [t.k, t.k, t.color] as const)].map(([k, l, c]) => (
            <button
              key={k}
              onClick={() => setBrush((b) => (b === k ? null : k))}
              title={k === "PRES" ? "Présent (efface)" : LEAVE_LABEL[k as LeaveType]}
              className={cn("rounded-lg border px-2 py-1 text-xs font-bold transition-all", brush === k ? "scale-105 border-ink shadow" : "border-transparent opacity-80 hover:opacity-100")}
              style={{ background: `color-mix(in srgb, ${c} 22%, transparent)`, color: k === "PRES" ? "var(--ink)" : c }}
            >
              {l}
            </button>
          ))}
          {brush && (
            <Button size="sm" variant="ghost" onClick={() => setBrush(null)}>
              <X className="h-3.5 w-3.5" /> Arrêter
            </Button>
          )}
        </div>}
      </Card>
      {brush && <p className="text-sm text-muted">Cliquez sur les cases pour appliquer « {brush === "PRES" ? "Présent" : LEAVE_LABEL[brush as LeaveType]} ». La saisie jour par jour remplace les demandes validées ce jour-là.</p>}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto [contain:paint]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-surface-2/60">
                <th className="sticky left-0 z-10 min-w-[150px] bg-surface-2 px-3 py-2 text-left font-semibold">Collaborateur</th>
                {days.map((d) => (
                  <th key={d.getDate()} className={cn("min-w-[30px] px-0.5 py-1.5 text-center font-semibold", !isWorkDay(d) && "text-muted/60", iso(d) === iso(today()) && "text-brand")}>
                    <div className="text-[10px]">{DAYS_SHORT[d.getDay()]}</div>
                    <div>{d.getDate()}</div>
                  </th>
                ))}
              </tr>
            </thead>
            {TEAM_ORDER.map((g) => {
              const rows = team.filter((e) => e.team === g);
              if (!rows.length) return null;
              const max = teamMax(g, settings);
              return (
                <tbody key={g}>
                  <tr>
                    <td colSpan={days.length + 1} className="sticky left-0 bg-surface px-3 pt-3 pb-1 text-[11px] font-bold tracking-wide text-muted uppercase">
                      {TEAMS[g]}
                    </td>
                  </tr>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-t border-line/60">
                      <td className="sticky left-0 z-10 truncate bg-surface px-3 py-1 font-medium">
                        <Link href={`/equipe/${e.id}`} className="hover:text-brand">
                          {e.name}
                        </Link>
                        {e.freelance && <span className="ml-1 text-[10px] text-muted">free</span>}
                      </td>
                      {days.map((d) => {
                        if (!isWorkDay(d)) return <td key={d.getDate()} className="bg-surface-2/50" title={isHoliday(d) ? "Férié" : ""} />;
                        if (e.freelance) {
                          const on = calls.some((c) => c.employee_id === e.id && c.date === iso(d) && c.triggered);
                          return (
                            <td key={d.getDate()} className="p-0.5 text-center">
                              {on && <span className="block rounded bg-ok/20 text-[10px] font-bold text-ok">Déc</span>}
                            </td>
                          );
                        }
                        const c = cellOf(e, d);
                        return (
                          <td key={d.getDate()} className="p-0.5">
                            <button
                              onClick={() => paint(e, d)}
                              disabled={!brush}
                              title={c ? `${LEAVE_LABEL[c.type]}${c.pending ? " (en attente)" : ""}` : "Présent"}
                              className={cn("block h-6 w-full rounded-md text-[10px] font-bold transition-transform", brush && "cursor-crosshair hover:scale-110", !c && brush && "hover:bg-surface-2")}
                              style={
                                c
                                  ? c.pending
                                    ? { background: `repeating-linear-gradient(45deg, color-mix(in srgb, ${LEAVE_COLOR[c.type]} 25%, transparent) 0 4px, transparent 4px 8px)`, color: LEAVE_COLOR[c.type] }
                                    : { background: LEAVE_COLOR[c.type], color: "white" }
                                  : undefined
                              }
                            >
                              {c ? c.type : ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t border-line bg-surface-2/40">
                    <td className="sticky left-0 z-10 bg-surface-2 px-3 py-1 text-[11px] font-semibold text-muted">{max != null ? `Absents (seuil ${max})` : "Absents"}</td>
                    {days.map((d) => {
                      if (!isWorkDay(d)) return <td key={d.getDate()} />;
                      const n = absentCount(d, g);
                      return (
                        <td key={d.getDate()} className={cn("text-center text-[11px] font-bold", max != null && n > max ? "text-bad" : n ? "text-ink" : "text-muted/50")}>
                          {n}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              );
            })}
          </table>
        </div>
      </Card>
      <Legend inline items={LEAVE_TYPES.map((t) => ({ label: t.label, color: t.color }))} />
    </div>
  );
}

// ---------------------------------------------------------------------
// Demandes
// ---------------------------------------------------------------------
function RequestsTab({ employees, leaves, onEdit }: Props & { onEdit: (r: LeaveRequest) => void }) {
  const router = useRouter();
  const canEdit = usePerms().write("conges");
  const [, start] = useTransition();
  const name = (id: string) => employees.find((e) => e.id === id)?.name || "?";
  const decide = (r: LeaveRequest, s: "approved" | "rejected") =>
    start(async () => {
      const res = await decideLeave(r.id, s);
      if (!res.ok) return void toast.error(res.error);
      toast.success(s === "approved" ? `Demande de ${name(r.employee_id)} validée` : `Demande de ${name(r.employee_id)} refusée`, {
        action: { label: "Annuler", onClick: async () => { await decideLeave(r.id, "pending"); router.refresh(); } },
      });
      router.refresh();
    });
  const pending = leaves.filter((r) => r.status === "pending").sort((a, b) => a.start_date.localeCompare(b.start_date));

  return (
    <div className="grid gap-6">
      {pending.length > 0 && (
        <Card>
          <CardHeader title="À valider" subtitle={`${pending.length} demande(s) en attente`} />
          <ul className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
            {pending.map((r, i) => (
              <motion.li
                key={r.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl border border-line bg-surface-2/40 p-4"
              >
                <div className="flex items-center gap-2">
                  <b className="flex-1 truncate">{name(r.employee_id)}</b>
                  <ColorBadge color={LEAVE_COLOR[r.type]}>{LEAVE_LABEL[r.type]}</ColorBadge>
                </div>
                <p className="mt-1 text-sm">
                  {fmtDate(r.start_date)} → {fmtDate(r.end_date)} · <b>{requestDays(r)} j</b>
                </p>
                {r.comment && <p className="mt-1 text-sm text-muted">{r.comment}</p>}
                {canEdit && <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => decide(r, "approved")}>
                    <Check className="h-3.5 w-3.5" /> Valider
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => decide(r, "rejected")}>
                    <X className="h-3.5 w-3.5" /> Refuser
                  </Button>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onEdit(r)}>
                    Modifier
                  </Button>
                </div>}
              </motion.li>
            ))}
          </ul>
        </Card>
      )}
      <DataTable
        rows={leaves}
        table="leave_requests"
        exportName="demandes-conges"
        onEdit={onEdit}
        searchText={(r) => `${name(r.employee_id)} ${LEAVE_LABEL[r.type]} ${r.comment || ""}`}
        initialSort={{ key: "start", dir: "desc" }}
        filters={[
          { key: "status", label: "Statut", options: Object.entries(LEAVE_STATUS).map(([k, v]) => [k, v.label]), value: (r) => r.status },
          { key: "type", label: "Motif", options: LEAVE_TYPES.map((t) => [t.k, t.label]), value: (r) => r.type },
          { key: "emp", label: "Collaborateur", options: employees.filter((e) => !e.freelance).map((e) => [e.id, e.name]), value: (r) => r.employee_id },
        ]}
        columns={[
          { key: "who", header: "Collaborateur", sort: (r) => name(r.employee_id), cell: (r) => <b>{name(r.employee_id)}</b> },
          { key: "type", header: "Motif", sort: (r) => LEAVE_LABEL[r.type], cell: (r) => <ColorBadge color={LEAVE_COLOR[r.type]}>{LEAVE_LABEL[r.type]}</ColorBadge> },
          { key: "start", header: "Du", sort: (r) => r.start_date, exportValue: (r) => fmtDate(r.start_date), cell: (r) => <span className="tabular">{fmtDate(r.start_date)}</span> },
          { key: "end", header: "Au", sort: (r) => r.end_date, exportValue: (r) => fmtDate(r.end_date), cell: (r) => <span className="tabular">{fmtDate(r.end_date)}</span> },
          { key: "days", header: "Jours", className: "text-right", sort: (r) => requestDays(r), cell: (r) => requestDays(r) },
          { key: "status", header: "Statut", sort: (r) => r.status, exportValue: (r) => LEAVE_STATUS[r.status].label, cell: (r) => <Badge tone={LEAVE_STATUS[r.status].tone} dot>{LEAVE_STATUS[r.status].label}</Badge> },
          { key: "comment", header: "Commentaire", hideOnMobile: true, exportValue: (r) => r.comment, cell: (r) => <span className="line-clamp-1 text-muted">{r.comment}</span> },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Soldes et statistiques
// ---------------------------------------------------------------------
function BalancesTab({ year, employees, leaves, marks }: Props) {
  const router = useRouter();
  const team = employees.filter((e) => !e.freelance && e.active);
  const rows = useMemo(() => team.map((e) => ({ ...e, b: balances(e, year, leaves, marks) })), [team, year, leaves, marks]);

  const { monthly, byType, total } = useMemo(() => {
    const monthly = MONTHS.map((m) => ({ m: m.slice(0, 3), ...Object.fromEntries(LEAVE_TYPES.map((t) => [t.k, 0])) })) as Record<string, number | string>[];
    const byType: Record<string, number> = {};
    let total = 0;
    for (let d = new Date(year, 0, 1); d.getFullYear() === year; d = addDays(d, 1)) {
      if (!isWorkDay(d)) continue;
      for (const a of absencesOn(d, leaves, marks)) {
        if (!team.some((e) => e.id === a.employee_id)) continue;
        monthly[d.getMonth()][a.type] = (monthly[d.getMonth()][a.type] as number) + 1;
        byType[a.type] = (byType[a.type] || 0) + 1;
        total++;
      }
    }
    return { monthly, byType, total };
  }, [year, leaves, marks, team]);

  const workDaysYear = useMemo(() => {
    let n = 0;
    for (let d = new Date(year, 0, 1); d.getFullYear() === year && d <= today(); d = addDays(d, 1)) if (isWorkDay(d)) n++;
    return n;
  }, [year]);
  const unplanned = (byType.MAL || 0) + (byType.AUI || 0) + (byType.ABS || 0);
  const rate = workDaysYear && team.length ? (unplanned / (workDaysYear * team.length)) * 100 : 0;
  const used = LEAVE_TYPES.filter((t) => byType[t.k]);

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => router.push(`/conges?tab=soldes&y=${year - 1}`)} aria-label="Année précédente">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="font-display text-lg font-bold">{year}</p>
        <Button variant="outline" size="icon" onClick={() => router.push(`/conges?tab=soldes&y=${year + 1}`)} aria-label="Année suivante">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi index={0} label="Jours d'absence" value={total} sub="jours ouvrés, tous motifs" />
        <Kpi index={1} label="CP restants (équipe)" value={rows.reduce((s, r) => s + r.b.cpLeft, 0)} decimals={1} tone="info" />
        <Kpi index={2} label="Absences non planifiées" value={unplanned} tone={unplanned ? "warn" : "ok"} sub="maladie, absent, injustifiée" />
        <Kpi index={3} label="Taux d'absentéisme" value={rate} decimals={1} suffix=" %" tone={rate > 5 ? "bad" : "ok"} sub="non planifié, depuis janvier" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Jours d'absence par mois" subtitle="Par motif, jours ouvrés" />
          <div className="px-3 pb-4">
            {used.length ? <Bars data={monthly} x="m" stacked series={used.map((t) => ({ key: t.k, label: t.label, color: t.color }))} height={280} /> : <Empty title="Aucune absence" />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Répartition par motif" />
          <div className="px-5 pb-5">
            {used.length ? (
              <>
                <Donut
                  data={used.map((t) => ({ name: t.label, value: byType[t.k], color: t.color }))}
                  center={
                    <div>
                      <p className="font-display text-2xl font-bold">{total}</p>
                      <p className="text-xs text-muted">jours</p>
                    </div>
                  }
                />
                <Legend items={used.map((t) => ({ label: t.label, color: t.color, value: byType[t.k] }))} />
              </>
            ) : (
              <Empty title="Aucune donnée" />
            )}
          </div>
        </Card>
      </div>
      <DataTable
        rows={rows}
        exportName={`soldes-${year}`}
        rowHref={(r) => `/equipe/${r.id}?y=${year}`}
        searchText={(r) => r.name}
        initialSort={{ key: "name", dir: "asc" }}
        filters={[{ key: "team", label: "Équipe", options: Object.entries(TEAMS), value: (r) => r.team }]}
        columns={[
          { key: "name", header: "Collaborateur", sort: (r) => r.name, cell: (r) => <b>{r.name}</b> },
          { key: "acq", header: "CP acquis", className: "text-right", sort: (r) => r.b.cpAcq, cell: (r) => nf(r.b.cpAcq, 1) },
          { key: "taken", header: "CP pris", className: "text-right", sort: (r) => r.b.cpTaken, cell: (r) => nf(r.b.cpTaken, 1) },
          { key: "left", header: "CP restants", className: "text-right", sort: (r) => r.b.cpLeft, cell: (r) => <b className={r.b.cpLeft < 0 ? "text-bad" : r.b.cpLeft > 15 ? "text-warn" : "text-ok"}>{nf(r.b.cpLeft, 1)}</b> },
          { key: "rtt", header: "RTT restants", className: "text-right", sort: (r) => r.b.rttLeft, cell: (r) => nf(r.b.rttLeft, 1) },
          { key: "rec", header: "Récup.", className: "text-right", sort: (r) => r.b.recLeft, cell: (r) => nf(r.b.recLeft, 1) },
          { key: "mal", header: "Maladie", className: "text-right", hideOnMobile: true, sort: (r) => r.b.taken.MAL || 0, cell: (r) => r.b.taken.MAL || "–" },
        ]}
      />
    </div>
  );
}
