"use client";
import { CanWrite, usePerms } from "@/components/app/perms-context";
import Link from "next/link";
import { ArrowLeft, CalendarPlus, Mail, PackageX, Pencil, Phone } from "lucide-react";
import { useMemo } from "react";
import { Bars } from "@/components/charts/charts";
import { HistoryCardClient } from "@/components/app/history-client";
import { Badge, ColorBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { EntityForm, useEditor } from "@/components/ui/entity-form";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { LEAVE_COLOR, LEAVE_LABEL, LEAVE_STATUS, LEAVE_TYPES, TEAMS } from "@/lib/domain/constants";
import type { balances } from "@/lib/domain/conges";
import { absencesOn, requestDays } from "@/lib/domain/conges";
import { MONTHS, addDays, fmtDate, isWorkDay } from "@/lib/domain/dates";
import type { AuditEntry, DayMark, DeliveryError, Employee, LeaveRequest } from "@/lib/types";
import { nf } from "@/lib/utils";
import { EMPLOYEE_FIELDS, employeeInitial } from "../fields";
import { LeaveForm } from "../../conges/leave-form";

export function EmployeeDetail({
  emp, year, bal, requests, marks, errors, audit,
}: {
  emp: Employee; year: number; bal: ReturnType<typeof balances>; requests: LeaveRequest[]; marks: DayMark[]; errors: DeliveryError[]; audit: AuditEntry[];
}) {
  const ed = useEditor<Employee>();
  const leave = useEditor<LeaveRequest>();
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
      <Link href="/equipe" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Équipe
      </Link>
      <PageHeader
        title={emp.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {emp.job_title}
            <Badge tone={emp.team === "prep" ? "violet" : "info"}>{TEAMS[emp.team]}</Badge>
            {emp.freelance && <Badge tone="warn">Freelance</Badge>}
            {!emp.active && <Badge>Sorti de l&apos;équipe</Badge>}
          </span>
        }
        icon={<span className="font-display text-xl font-bold">{emp.name.charAt(0)}</span>}
        actions={
          <>
            {emp.phone && (
              <a href={`tel:${emp.phone}`}>
                <Button variant="outline"><Phone className="h-4 w-4" /> Appeler</Button>
              </a>
            )}
            {emp.email && (
              <a href={`mailto:${emp.email}`}>
                <Button variant="outline"><Mail className="h-4 w-4" /> E-mail</Button>
              </a>
            )}
            {!emp.freelance && perms.write("conges") && (
              <Button variant="secondary" onClick={leave.create}>
                <CalendarPlus className="h-4 w-4" /> Demande de congé
              </Button>
            )}
            <CanWrite module="equipe">
              <Button onClick={() => ed.edit(emp)}>
                <Pencil className="h-4 w-4" /> Modifier
              </Button>
            </CanWrite>
          </>
        }
      />
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
            <CardHeader title="Coordonnées" />
            <dl className="grid gap-3 px-5 pb-5 text-sm">
              {[
                ["Téléphone", emp.phone],
                ["E-mail", emp.email],
                ["Entrée", fmtDate(emp.hired_on)],
                ["Notes", emp.notes],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-semibold text-muted uppercase">{k}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{v || "–"}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <HistoryCardClient entries={audit} />
        </div>
      </div>
      <EntityForm open={ed.open} onClose={ed.close} title={`Modifier ${emp.name}`} table="employees" id={emp.id} initial={employeeInitial(emp)} fields={EMPLOYEE_FIELDS} />
      <LeaveForm open={leave.open} onClose={leave.close} row={leave.row} employees={[emp]} requests={requests} defaultEmployee={emp.id} />
    </>
  );
}
