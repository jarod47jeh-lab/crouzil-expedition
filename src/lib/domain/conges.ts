import type { DayMark, Employee, LeaveRequest, LeaveType } from "@/lib/types";
import { addDays, iso, isWorkDay, parse, workDays } from "./dates";

export interface Absence {
  employee_id: string;
  type: LeaveType;
  pending?: boolean;
}

/** Qui est absent ce jour-là : demandes validées, corrigées par la saisie jour par jour. */
export function absencesOn(day: Date, reqs: LeaveRequest[], marks: DayMark[], withPending = false): Absence[] {
  const k = iso(day);
  const out = new Map<string, Absence>();
  for (const r of reqs) {
    if (r.deleted_at) continue;
    if (r.start_date <= k && k <= r.end_date) {
      if (r.status === "approved") out.set(r.employee_id, { employee_id: r.employee_id, type: r.type });
      else if (withPending && r.status === "pending" && !out.has(r.employee_id))
        out.set(r.employee_id, { employee_id: r.employee_id, type: r.type, pending: true });
    }
  }
  for (const m of marks) {
    if (m.date !== k) continue;
    if (m.type === "PRES") out.delete(m.employee_id);
    else out.set(m.employee_id, { employee_id: m.employee_id, type: m.type });
  }
  return [...out.values()];
}

/** Jours d'absence ouvrés par collaborateur et par type pour une période */
export function daysTaken(emp: string, from: Date, to: Date, reqs: LeaveRequest[], marks: DayMark[]) {
  const res: Partial<Record<LeaveType, number>> = {};
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    if (!isWorkDay(d)) continue;
    const a = absencesOn(d, reqs.filter((r) => r.employee_id === emp), marks.filter((m) => m.employee_id === emp));
    if (a[0]) res[a[0].type] = (res[a[0].type] || 0) + 1;
  }
  return res;
}

export function balances(e: Employee, year: number, reqs: LeaveRequest[], marks: DayMark[]) {
  const t = daysTaken(e.id, new Date(year, 0, 1), new Date(year, 11, 31), reqs, marks);
  const cpAcq = Number(e.cp_annual) + Number(e.cp_carryover);
  return {
    taken: t,
    cpAcq,
    cpTaken: t.CP || 0,
    cpLeft: cpAcq - (t.CP || 0),
    rttLeft: Number(e.rtt_annual) - (t.RTT || 0),
    recLeft: Number(e.rec_due) - (t.REC || 0),
  };
}

export const requestDays = (r: Pick<LeaveRequest, "start_date" | "end_date">) => workDays(parse(r.start_date), parse(r.end_date));

/** Chevauchement avec une autre demande du même collaborateur */
export function overlaps(r: Pick<LeaveRequest, "employee_id" | "start_date" | "end_date">, reqs: LeaveRequest[], exceptId?: string) {
  return reqs.filter(
    (x) => x.id !== exceptId && !x.deleted_at && x.status !== "rejected" && x.employee_id === r.employee_id && x.start_date <= r.end_date && r.start_date <= x.end_date,
  );
}

export interface AbsencePeriod {
  type: LeaveType;
  from: string;
  to: string;
  pending: boolean;
}
/** Périodes d'absence d'un collaborateur à partir d'un jour (jours ouvrés regroupés), sur `horizon` jours */
export function absencePeriods(empId: string, from: Date, reqs: LeaveRequest[], marks: DayMark[], horizon = 120): AbsencePeriod[] {
  const r = reqs.filter((x) => x.employee_id === empId && !x.deleted_at && x.status !== "rejected");
  const m = marks.filter((x) => x.employee_id === empId);
  const out: AbsencePeriod[] = [];
  let cur: AbsencePeriod | null = null;
  for (let i = 0, d = new Date(from); i < horizon; i++, d = addDays(d, 1)) {
    if (!isWorkDay(d)) continue;
    const a = absencesOn(d, r, m, true)[0];
    const k = iso(d);
    if (a && cur && cur.type === a.type && !!a.pending === cur.pending) cur.to = k;
    else {
      if (cur) out.push(cur);
      cur = a ? { type: a.type, from: k, to: k, pending: !!a.pending } : null;
    }
  }
  if (cur) out.push(cur);
  return out;
}
