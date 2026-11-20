"use client";
import { CanWrite, usePerms } from "@/components/app/perms-context";
import Link from "next/link";
import { ArrowLeft, Award, CalendarPlus, Mail, MapPin, PackageX, Pencil, Phone, Printer, Smile } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { AvatarPicker } from "@/components/app/avatar-picker";
import { Bars } from "@/components/charts/charts";
import { HistoryCardClient } from "@/components/app/history-client";
import { Badge, ColorBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { LEAVE_COLOR, LEAVE_LABEL, LEAVE_STATUS, LEAVE_TYPES, TEAM_TONE, TEAMS } from "@/lib/domain/constants";
import type { balances } from "@/lib/domain/conges";
import { absencesOn, requestDays } from "@/lib/domain/conges";
import { MONTHS, addDays, fmtDate, isWorkDay } from "@/lib/domain/dates";
import type { AuditEntry, DayMark, DeliveryError, Employee, EquipmentIssue, EquipmentItem, LeaveRequest, Qualification, QualificationType } from "@/lib/types";
import { appliesTo, QUAL_CATEGORIES, QUAL_STATE, qualStatus } from "@/lib/domain/qualifications";
import { ZONE_META } from "@/components/depot/overview";
import { zoneOfEmployee } from "@/components/depot/summary";
import { TEAM_SHIRT } from "@/lib/domain/avatar";
import { applies, ISSUE_STATE, issueStatus, SIZE_KINDS } from "@/lib/domain/equipment";
import { iso, today } from "@/lib/domain/dates";
import { nf } from "@/lib/utils";
import { EMPLOYEE_FIELDS, employeeInitial } from "../fields";
import { LeaveForm } from "../../conges/leave-form";

export function EmployeeDetail({
  emp, year, bal, requests, marks, errors, audit, items = [], issues = [], qualTypes = [], quals = [],
}: {
  emp: Employee; year: number; bal: ReturnType<typeof balances>; requests: LeaveRequest[]; marks: DayMark[]; errors: DeliveryError[]; audit: AuditEntry[]; items?: EquipmentItem[]; issues?: EquipmentIssue[]; qualTypes?: QualificationType[]; quals?: Qualification[];
}) {
  const t = iso(today());
  const seniority = emp.hired_on ? (Date.now() - new Date(emp.hired_on).getTime()) / (365.25 * 86400000) : null;
  const myQuals = qualTypes
    .filter((ty) => appliesTo(ty, emp.team) || quals.some((q) => q.type_id === ty.id))
    .map((ty) => ({ ty, ...qualStatus(ty, emp, quals, t) }))
    .filter((x) => x.state !== "none" || x.ty.required);
  const qAlert = myQuals.filter((x) => x.state === "expired" || x.state === "missing" || x.state === "soon").length;
  const absentToday = absencesOn(today(), requests, marks)[0];
  const ed = useEditor<Employee>();
  const leave = useEditor<LeaveRequest>();
  const [picker, setPicker] = useState(false);
  const perms = usePerms();

  const monthly = useMemo(() => {
    const rows = MONTHS.map((m) => ({ m: m.slice(0, 3), ...Object.fromEntries(LEAVE_TYPES.map((t) => [t.k, 0])) })) as Record<string, number | string>[];
    for (let d = new Date(year, 0, 1); d.getFullYear() === year; d = addDays(d, 1)) {
      if (!isWorkDay(d)) continue;
      const a = absencesOn(d, requests, marks)[0];
      if (a) rows[d.getMonth()][a.type] = (rows[d.getMonth()][a.type] as number) + 1;
    }
    return rows;
  }, [marks, requests, year]);
  const used = LEAVE_TYPES.filter((t) => monthly.some((r) => (r[t.k] as number) > 0));

  return (
    <>
      <Link href="/equipe" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink print:hidden">
        <ArrowLeft className="h-4 w-4" /> Équipe
      </Link>
      <Card className="relative mb-6 overflow-hidden print:shadow-none">
        <div className="absolute inset-x-0 top-0 h-24" style={{ background: `linear-gradient(120deg, ${TEAM_SHIRT[emp.team]}, color-mix(in srgb, ${TEAM_SHIRT[emp.team]} 55%, transparent))` }} />
        <div className="relative grid gap-5 px-5 pt-10 pb-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-end">
          <div className="w-fit rounded-full bg-surface p-1.5 shadow-lg ring-1 ring-line">
            <Avatar e={emp} size={124} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight font-bold">{emp.name}</h1>
            <p className="mt-0.5 text-muted">{emp.job_title || "Fonction à renseigner"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone={TEAM_TONE[emp.team]}>{TEAMS[emp.team]}</Badge>
              {emp.freelance && <Badge tone="warn">Freelance</Badge>}
              {!emp.active && <Badge>Sorti de l&apos;équipe</Badge>}
              {absentToday ? <ColorBadge color={LEAVE_COLOR[absentToday.type]}>Aujourd&apos;hui : {LEAVE_LABEL[absentToday.type]}</ColorBadge> : emp.active && <Badge tone="ok">Présent aujourd&apos;hui</Badge>}
              {qAlert > 0 && <Badge tone="bad">{qAlert} qualification(s) à traiter</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden lg:justify-end">
            {perms.admin && (
              <Button variant="outline" onClick={() => setPicker(true)}>
                <Smile className="h-4 w-4" /> Avatar
              </Button>
            )}
            {!emp.freelance && perms.write("conges") && (
              <Button variant="secondary" onClick={leave.create}>
                <CalendarPlus className="h-4 w-4" /> Demande de congé
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimer
            </Button>
            <CanWrite module="equipe">
              <Button onClick={() => ed.edit(emp)}>
                <Pencil className="h-4 w-4" /> Modifier
              </Button>
            </CanWrite>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {([
            ["Téléphone", emp.phone ? <a href={`tel:${emp.phone}`} className="inline-flex items-center gap-1 font-semibold hover:text-brand"><Phone className="h-3.5 w-3.5" />{emp.phone}</a> : null],
            ["E-mail", emp.email ? <a href={`mailto:${emp.email}`} className="inline-flex max-w-full min-w-0 items-center gap-1 font-semibold hover:text-brand"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{emp.email}</span></a> : null],
            ["Poste dans le dépôt", <span key="zone" className="inline-flex items-center gap-1 font-semibold"><MapPin className="h-3.5 w-3.5" />{ZONE_META[zoneOfEmployee(emp)].name}</span>],
            ["Entrée", emp.hired_on ? <b>{fmtDate(emp.hired_on)}</b> : null],
            ["Ancienneté", seniority != null ? <b>{seniority < 1 ? `${Math.round(seniority * 12)} mois` : `${nf(seniority, 1)} ans`}</b> : null],
            ["Tailles", <b key="sizes">{SIZE_KINDS.map((k) => (emp[k.col] as string | null)?.split(" ")[0] || "—").join(" · ")}</b>],
          ] as [string, React.ReactNode][]).map(([k, v]) => (
            <div key={k} className="min-w-0 bg-surface px-4 py-3">
              <dt className="text-[11px] font-semibold tracking-wide text-muted uppercase">{k}</dt>
              <dd className="mt-0.5 min-w-0 text-sm">{v || <span className="text-muted">–</span>}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {!emp.freelance && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi index={0} label={`CP restants ${year}`} value={bal.cpLeft} decimals={1} tone={bal.cpLeft < 0 ? "bad" : "ok"} sub={`${nf(bal.cpAcq, 1)} acquis, ${nf(bal.cpTaken, 1)} pris`} />
          <Kpi index={1} label="RTT restants" value={bal.rttLeft} decimals={1} tone="info" sub={`${nf(emp.rtt_annual, 1)} par an`} />
          <Kpi index={2} label="Récup. restante" value={bal.recLeft} decimals={1} tone="violet" sub={`${nf(emp.rec_due, 1)} jours dus`} />
          <Kpi index={3} label="Erreurs liées" value={errors.length} tone={errors.length ? "warn" : "ink"} sub="préparation ou livraison" />
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader title={`Absences ${year}`} subtitle="Jours ouvrés par mois et par motif" />
            <div className="px-3 pb-4">
              {used.length ? <Bars data={monthly} x="m" stacked series={used.map((t) => ({ key: t.k, label: t.label, color: t.color }))} /> : <Empty title="Aucune absence cette année" />}
            </div>
          </Card>
          <Card>
            <CardHeader title="Demandes de congés" subtitle={`${requests.length} en ${year}`} />
            {requests.length ? (
              <ul className="divide-y divide-line">
                {requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <ColorBadge color={LEAVE_COLOR[r.type]}>{LEAVE_LABEL[r.type]}</ColorBadge>
                    <span className="tabular">
                      {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                    </span>
                    <span className="text-muted">{requestDays(r)} j</span>
                    <Badge tone={LEAVE_STATUS[r.status].tone} className="ml-auto">{LEAVE_STATUS[r.status].label}</Badge>
                    {perms.write("conges") && (
                      <button onClick={() => leave.edit(r)} className="text-muted hover:text-brand" aria-label="Modifier">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="Aucune demande" />
            )}
          </Card>
          <Card>
            <CardHeader title="Erreurs de livraison liées" subtitle="Où ce collaborateur est indiqué comme préparateur, chauffeur ou responsable" />
            {errors.length ? (
              <ul className="divide-y divide-line">
                {errors.slice(0, 20).map((e) => (
                  <li key={e.id} className="grid gap-0.5 px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <b>{e.client_name}</b>
                      <Badge tone="warn">{e.error_type}</Badge>
                      <span className="ml-auto text-xs text-muted">{fmtDate(e.date)}</span>
                    </div>
                    {e.comment && <p className="text-muted">{e.comment}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={<PackageX className="h-5 w-5" />} title="Aucune erreur liée" />
            )}
          </Card>
        </div>
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader title="Qualifications et formations" actions={<Link href="/qualifications" className="text-sm font-semibold text-brand print:hidden">Gérer</Link>} />
            {myQuals.length ? (
              <ul className="grid gap-1.5 px-5 pb-5 text-sm">
                {myQuals.map(({ ty, state, expires, last }) => (
                  <li key={ty.id} className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium" title={ty.name}>{ty.name}</span>
                      <span className="text-xs text-muted">
                        {QUAL_CATEGORIES[ty.category].label}
                        {last?.obtained_on ? ` · obtenue le ${fmtDate(last.obtained_on)}` : ""}
                        {expires ? ` · échéance ${fmtDate(expires)}` : ""}
                      </span>
                    </span>
                    <Badge tone={QUAL_STATE[state].tone}>{QUAL_STATE[state].short}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={<Award className="h-5 w-5" />} title="Aucune qualification suivie" />
            )}
          </Card>
          <Card>
            <CardHeader title="Tenue et équipements" actions={<Link href={`/equipements?tab=dotations&team=${emp.team}`} className="text-sm font-semibold text-brand">Gérer</Link>} />
            <div className="grid gap-3 px-5 pb-5">
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {SIZE_KINDS.map((k) => (
                  <div key={k.k} className="rounded-xl bg-surface-2 px-1 py-2">
                    <p className="font-display text-[15px] leading-tight font-bold">{(emp[k.col] as string | null)?.split(" ")[0] || "—"}</p>
                    <p className="text-[11px] text-muted">{k.label}</p>
                  </div>
                ))}
              </div>
              <ul className="grid gap-1.5 text-sm">
                {items.filter((it) => applies(it, emp.team)).map((it) => {
                  const st = issueStatus(it, emp.id, issues, iso(today()));
                  return (
                    <li key={it.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">{it.name}</span>
                      <Badge tone={ISSUE_STATE[st.state].tone}>{ISSUE_STATE[st.state].short}</Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Card>
          {emp.notes && (
            <Card>
              <CardHeader title="Notes" />
              <p className="px-5 pb-5 text-sm whitespace-pre-wrap">{emp.notes}</p>
            </Card>
          )}
          <HistoryCardClient entries={audit} />
        </div>
      </div>
      <EntityForm open={ed.open} onClose={ed.close} title={`Modifier ${emp.name}`} table="employees" id={emp.id} initial={employeeInitial(emp)} fields={EMPLOYEE_FIELDS} />
      <LeaveForm open={leave.open} onClose={leave.close} row={leave.row} employees={[emp]} requests={requests} defaultEmployee={emp.id} />
      {perms.admin && <AvatarPicker emp={emp} open={picker} onClose={() => setPicker(false)} />}
    </>
  );
}
