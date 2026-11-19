/* Export « Planning et congés » sur une période : indicateurs (absences, absentéisme, demandes, seuils),
   planning jour par jour, détail des absences, demandes, soldes et freelances. */
import { balances, requestDays } from "@/lib/domain/conges";
import { LEAVE_LABEL, LEAVE_STATUS, LEAVE_TYPES, TEAM_ORDER, TEAMS, teamMax } from "@/lib/domain/constants";
import { addDays, DAYS_SHORT, fmtDate, isHoliday, iso, isWorkDay, MONTHS, parse } from "@/lib/domain/dates";
import type { DayMark, Employee, FreelanceCall, LeaveRequest, LeaveType, Settings } from "@/lib/types";
import { pct, round1, type Cell, type Sheet } from "./workbook";

export interface CongesExportData {
  employees: Employee[];
  leaves: LeaveRequest[];
  marks: DayMark[];
  calls: FreelanceCall[];
  settings: Settings;
  from: Date;
  to: Date;
  /** Libellé de la période, ex. « Novembre 2026 » ou « Année 2026 » */
  label: string;
}

/** Absences non planifiées : comptent dans le taux d'absentéisme */
const UNPLANNED: LeaveType[] = ["MAL", "AUI", "ABS"];

export function buildCongesWorkbook(d: CongesExportData): Sheet[] {
  const staff = d.employees.filter((e) => e.active && !e.freelance);
  const freelances = d.employees.filter((e) => e.active && e.freelance);
  const empById = new Map(d.employees.map((e) => [e.id, e]));
  const days: Date[] = [];
  for (let x = new Date(d.from); x <= d.to; x = addDays(x, 1)) days.push(new Date(x));
  const work = days.filter(isWorkDay);
  const fromK = iso(d.from), toK = iso(d.to);
  const live = d.leaves.filter((r) => !r.deleted_at);

  // absence de chacun, jour par jour : demandes validées corrigées par la saisie au planning, plus les demandes en attente
  type Abs = { type: LeaveType; source: "Demande validée" | "Saisie au planning" | "En attente" };
  const at = new Map<string, Map<string, Abs>>(); // jour -> collaborateur -> absence
  const leavesOf = new Map<string, LeaveRequest[]>(), marksOf = new Map<string, DayMark[]>();
  live.forEach((r) => leavesOf.set(r.employee_id, [...(leavesOf.get(r.employee_id) || []), r]));
  d.marks.forEach((m) => marksOf.set(m.employee_id, [...(marksOf.get(m.employee_id) || []), m]));
  for (const day of days) {
    const k = iso(day);
    const map = new Map<string, Abs>();
    for (const e of d.employees) {
      const mk = (marksOf.get(e.id) || []).find((m) => m.date === k);
      if (mk) {
        if (mk.type !== "PRES") map.set(e.id, { type: mk.type, source: "Saisie au planning" });
        continue;
      }
      const rs = (leavesOf.get(e.id) || []).filter((r) => r.start_date <= k && k <= r.end_date);
      const ok = rs.find((r) => r.status === "approved");
      if (ok) map.set(e.id, { type: ok.type, source: "Demande validée" });
      else {
        const p = rs.find((r) => r.status === "pending");
        if (p) map.set(e.id, { type: p.type, source: "En attente" });
      }
    }
    at.set(k, map);
  }
  const confirmed = (k: string, id: string) => {
    const a = at.get(k)?.get(id);
    return a && a.source !== "En attente" ? a : null;
  };

  // comptes sur les jours ouvrés, absences confirmées des collaborateurs (hors freelances)
  const byEmp = new Map<string, Partial<Record<LeaveType, number>>>();
  const byType: Partial<Record<LeaveType, number>> = {};
  const byMonth = new Map<string, { work: number; abs: number; unpl: number }>();
  let peak = 0, peakDay = "", overThreshold = 0;
  for (const day of work) {
    const k = iso(day);
    const mKey = `${day.getFullYear()}-${day.getMonth()}`;
    const mo = byMonth.get(mKey) || { work: 0, abs: 0, unpl: 0 };
    mo.work++;
    let n = 0;
    const perTeam: Record<string, number> = {};
    for (const e of staff) {
      const a = confirmed(k, e.id);
      if (!a) continue;
      n++;
      perTeam[e.team] = (perTeam[e.team] || 0) + 1;
      const m = byEmp.get(e.id) || {};
      m[a.type] = (m[a.type] || 0) + 1;
      byEmp.set(e.id, m);
      byType[a.type] = (byType[a.type] || 0) + 1;
      mo.abs++;
      if (UNPLANNED.includes(a.type)) mo.unpl++;
    }
    byMonth.set(mKey, mo);
    if (n > peak) [peak, peakDay] = [n, k];
    if (TEAM_ORDER.some((g) => {
      const max = teamMax(g, d.settings);
      return max != null && (perTeam[g] || 0) > max;
    })) overThreshold++;
  }
  const sum = (m?: Partial<Record<LeaveType, number>>, types?: LeaveType[]) => Object.entries(m || {}).reduce((s, [t, v]) => s + (!types || types.includes(t as LeaveType) ? v || 0 : 0), 0);
  const totalAbs = sum(byType);
  const totalUnpl = sum(byType, UNPLANNED);
  const capacity = work.length * staff.length;
  const reqsIn = live.filter((r) => r.start_date <= toK && r.end_date >= fromK);
  const callsIn = d.calls.filter((c) => c.triggered && c.date >= fromK && c.date <= toK);

  /* ---- Indicateurs ---- */
  const k: Cell[][] = [
    ["Planning et congés"],
    ["Période", d.label],
    ["Du", fmtDate(fromK), "au", fmtDate(toK)],
    ["Extraction du", fmtDate(iso(new Date()))],
    [],
    ["INDICATEURS CLÉS", "Valeur", "Détail"],
    ["Jours ouvrés", work.length, "hors week-ends et jours fériés"],
    ["Effectif suivi", staff.length, "collaborateurs actifs, hors freelances"],
    ["Jours d'absence (tous motifs)", totalAbs, "jours ouvrés, absences validées ou saisies"],
    ["Taux d'absence (%)", pct(totalAbs, capacity), "jours d'absence / (effectif × jours ouvrés)"],
    ["Absences non planifiées (jours)", totalUnpl, "maladie, absence injustifiée, absent"],
    ["Taux d'absentéisme (%)", pct(totalUnpl, capacity), "non planifié / (effectif × jours ouvrés)"],
    ["Jours de maladie", byType.MAL || 0, ""],
    ["Pic d'absents le même jour", peak, peakDay ? fmtDate(peakDay) : ""],
    ["Jours au-dessus du seuil d'absents", overThreshold, `seuils : ${d.settings.max_abs} chauffeurs, ${d.settings.max_abs_prep} préparateurs`],
    ["Demandes sur la période", reqsIn.length, ""],
    ["   validées", reqsIn.filter((r) => r.status === "approved").length, ""],
    ["   en attente", reqsIn.filter((r) => r.status === "pending").length, ""],
    ["   refusées", reqsIn.filter((r) => r.status === "rejected").length, ""],
    ["Jours de freelances déclenchés", callsIn.length, freelances.map((f) => `${f.name} : ${callsIn.filter((c) => c.employee_id === f.id).length}`).join(" · ")],
    [],
    ["PAR ÉQUIPE"],
    ["Équipe", "Effectif", "Jours d'absence", "Taux d'absence (%)", "Non planifié (jours)", "Taux d'absentéisme (%)", "Congés payés pris (jours)", "Seuil d'absents"],
  ];
  TEAM_ORDER.forEach((g) => {
    const list = staff.filter((e) => e.team === g);
    if (!list.length) return;
    const abs = list.reduce((s, e) => s + sum(byEmp.get(e.id)), 0);
    const unpl = list.reduce((s, e) => s + sum(byEmp.get(e.id), UNPLANNED), 0);
    const cap = list.length * work.length;
    k.push([TEAMS[g], list.length, abs, pct(abs, cap), unpl, pct(unpl, cap), list.reduce((s, e) => s + (byEmp.get(e.id)?.CP || 0), 0), teamMax(g, d.settings) ?? "—"]);
  });
  k.push([], ["PAR MOTIF"], ["Motif", "Code", "Jours", "Part (%)"]);
  LEAVE_TYPES.forEach((t) => {
    if (byType[t.k]) k.push([t.label, t.k, byType[t.k]!, pct(byType[t.k]!, totalAbs)]);
  });
  if (byMonth.size > 1) {
    k.push([], ["PAR MOIS"], ["Mois", "Jours ouvrés", "Jours d'absence", "Taux d'absence (%)", "Non planifié (jours)", "Taux d'absentéisme (%)"]);
    [...byMonth.entries()].forEach(([key, m]) => {
      const [y, mm] = key.split("-").map(Number);
      const cap = m.work * staff.length;
      k.push([`${MONTHS[mm]} ${y}`, m.work, m.abs, pct(m.abs, cap), m.unpl, pct(m.unpl, cap)]);
    });
  }
  const top = staff.map((e) => ({ e, n: sum(byEmp.get(e.id)), u: sum(byEmp.get(e.id), UNPLANNED) })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 10);
  if (top.length) {
    k.push([], ["COLLABORATEURS LES PLUS ABSENTS"], ["Collaborateur", "Équipe", "Jours d'absence", "dont non planifiés"]);
    top.forEach((x) => k.push([x.e.name, TEAMS[x.e.team], x.n, x.u]));
  }
  k.push([], ["LÉGENDE DU PLANNING"], ["Code", "Motif"], ...LEAVE_TYPES.map((t) => [t.k, t.label] as Cell[]), ["xx?", "Demande en attente (ex. CP?)"], ["D", "Freelance déclenché"], ["—", "Week-end ou jour férié"]);

  /* ---- Planning jour par jour ---- */
  const people = [...staff, ...freelances].sort((a, b) => TEAM_ORDER.indexOf(a.team) - TEAM_ORDER.indexOf(b.team) || a.name.localeCompare(b.name, "fr"));
  const planning: Cell[][] = [
    ["Collaborateur", "Équipe", ...days.map((x) => `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}`), "Jours d'absence"],
    ["", "", ...days.map((x) => (isHoliday(x) ? "Férié" : DAYS_SHORT[x.getDay()])), ""],
    ...people.map((e) => [
      e.name + (e.freelance ? " (freelance)" : ""),
      TEAMS[e.team],
      ...days.map((x) => {
        if (!isWorkDay(x)) return "—";
        const k2 = iso(x);
        if (e.freelance) return callsIn.some((c) => c.employee_id === e.id && c.date === k2) ? "D" : "";
        const a = at.get(k2)?.get(e.id);
        return a ? a.type + (a.source === "En attente" ? "?" : "") : "";
      }),
      e.freelance ? null : sum(byEmp.get(e.id)),
    ]),
  ];

  /* ---- Détail des absences ---- */
  const detail: Cell[][] = [["Date", "Jour", "Collaborateur", "Équipe", "Motif", "Code", "Origine"]];
  for (const x of work) {
    const k2 = iso(x);
    at.get(k2)?.forEach((a, id) => {
      const e = empById.get(id);
      if (!e || e.freelance) return;
      detail.push([fmtDate(k2), x.toLocaleDateString("fr-FR", { weekday: "long" }), e.name, TEAMS[e.team], LEAVE_LABEL[a.type], a.type, a.source]);
    });
  }

  /* ---- Demandes ---- */
  const reqs: Cell[][] = [
    ["Collaborateur", "Équipe", "Motif", "Du", "Au", "Jours ouvrés", "Statut", "Commentaire", "Déposée le"],
    ...reqsIn
      .slice()
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .map((r) => {
        const e = empById.get(r.employee_id);
        return [e?.name || "?", e ? TEAMS[e.team] : "", LEAVE_LABEL[r.type], fmtDate(r.start_date), fmtDate(r.end_date), requestDays(r), LEAVE_STATUS[r.status]?.label || r.status, r.comment, fmtDate(r.created_at?.slice(0, 10))];
      }),
  ];

  /* ---- Soldes de l'année ---- */
  const year = d.from.getFullYear();
  const soldes: Cell[][] = [
    ["Collaborateur", "Équipe", `CP acquis ${year}`, "CP pris", "CP restants", "RTT annuels", "RTT pris", "RTT restants", "Récup. dues", "Récup. prises", "Récup. restantes", ...LEAVE_TYPES.filter((t) => !["CP", "RTT", "REC"].includes(t.k)).map((t) => t.label + " (j)")],
    ...staff.map((e) => {
      const b = balances(e, year, live, d.marks);
      return [
        e.name, TEAMS[e.team], round1(b.cpAcq), b.cpTaken, round1(b.cpLeft), Number(e.rtt_annual), b.taken.RTT || 0, round1(b.rttLeft), Number(e.rec_due), b.taken.REC || 0, round1(b.recLeft),
        ...LEAVE_TYPES.filter((t) => !["CP", "RTT", "REC"].includes(t.k)).map((t) => b.taken[t.k] || 0),
      ];
    }),
  ];

  const sheets: Sheet[] = [
    { name: "Indicateurs", rows: k, widths: [36, 14, 16, 18, 20, 22, 24, 16] },
    { name: "Planning", rows: planning, freeze: 2, widths: [26, 18, ...days.map(() => 6), 14] },
    { name: "Absences", rows: detail, freeze: 1 },
    { name: "Demandes", rows: reqs, freeze: 1 },
    { name: `Soldes ${year}`, rows: soldes, freeze: 1 },
  ];
  if (freelances.length)
    sheets.push({
      name: "Freelances",
      rows: [["Date", "Freelance", "Déclenché"], ...callsIn.sort((a, b) => a.date.localeCompare(b.date)).map((c) => [fmtDate(c.date), empById.get(c.employee_id)?.name || "?", "Oui"])],
      freeze: 1,
    });
  return sheets;
}

/** Période d'un mois ou d'une année */
export const monthPeriod = (y: number, m: number) => ({ from: new Date(y, m, 1), to: new Date(y, m + 1, 0), label: `${MONTHS[m]} ${y}` });
export const yearPeriod = (y: number) => ({ from: new Date(y, 0, 1), to: new Date(y, 11, 31), label: `Année ${y}` });
export const customPeriod = (a: string, b: string) => ({ from: parse(a), to: parse(b), label: `Du ${fmtDate(a)} au ${fmtDate(b)}` });
