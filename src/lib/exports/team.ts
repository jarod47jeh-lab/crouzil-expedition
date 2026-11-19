/* Export « Équipes, collaborateurs, tenues et équipements » : indicateurs, fiches, tailles, état des dotations,
   historique, catalogue et besoins de commande par taille. */
import { ZONE_META } from "@/components/depot/overview";
import { zoneOfEmployee } from "@/components/depot/summary";
import { balances } from "@/lib/domain/conges";
import { TEAM_ORDER, TEAMS } from "@/lib/domain/constants";
import { fmtDate, iso, today } from "@/lib/domain/dates";
import { applies, CATEGORIES, ISSUE_STATE, issueStatus, SIZE_KINDS, sizeOf } from "@/lib/domain/equipment";
import type { DayMark, Employee, EquipmentIssue, EquipmentItem, LeaveRequest } from "@/lib/types";
import { pct, round1, type Cell, type Sheet } from "./workbook";

export interface TeamExportData {
  employees: Employee[];
  items: EquipmentItem[];
  issues: EquipmentIssue[];
  leaves: LeaveRequest[];
  marks: DayMark[];
  year: number;
}

const yesNo = (b: boolean) => (b ? "Oui" : "Non");
const seniority = (e: Employee) => (e.hired_on ? round1((Date.now() - new Date(e.hired_on).getTime()) / (365.25 * 86400000)) : null);
const sizesDone = (e: Employee) => SIZE_KINDS.every((s) => !!e[s.col]);

export function buildTeamWorkbook(d: TeamExportData): Sheet[] {
  const t = iso(today());
  const active = d.employees.filter((e) => e.active);
  const staff = active.filter((e) => !e.freelance);
  const itemById = new Map(d.items.map((i) => [i.id, i]));
  const empById = new Map(d.employees.map((e) => [e.id, e]));
  const bal = new Map(d.employees.map((e) => [e.id, balances(e, d.year, d.leaves, d.marks)]));

  // état de chaque article dû à chaque collaborateur
  const due = staff.flatMap((e) =>
    d.items.filter((it) => applies(it, e.team)).map((it) => ({ e, it, ...issueStatus(it, e.id, d.issues, t) })),
  );
  const count = (s: string) => due.filter((x) => x.state === s).length;

  /* ---- Indicateurs ---- */
  const k: Cell[][] = [
    ["Équipes, collaborateurs, tenues et équipements"],
    ["Extraction du", fmtDate(t)],
    [],
    ["EFFECTIF PAR ÉQUIPE"],
    ["Équipe", "Actifs", "dont freelances", "Sortis", "Ancienneté moyenne (ans)", "Tailles renseignées (%)", `CP restants ${d.year} (jours)`],
  ];
  const teamRow = (label: string, list: Employee[]) => {
    const act = list.filter((e) => e.active), fixed = act.filter((e) => !e.freelance);
    const sen = act.map(seniority).filter((x): x is number => x != null);
    return [
      label,
      act.length,
      act.filter((e) => e.freelance).length,
      list.filter((e) => !e.active).length,
      sen.length ? round1(sen.reduce((a, b) => a + b, 0) / sen.length) : null,
      pct(fixed.filter(sizesDone).length, fixed.length),
      round1(fixed.reduce((s, e) => s + (bal.get(e.id)?.cpLeft || 0), 0)),
    ];
  };
  TEAM_ORDER.forEach((g) => {
    const list = d.employees.filter((e) => e.team === g);
    if (list.length) k.push(teamRow(TEAMS[g], list));
  });
  k.push(teamRow("TOTAL", d.employees));
  k.push(
    [],
    ["TENUES ET ÉQUIPEMENTS"],
    ["Indicateur", "Valeur"],
    ["Articles actifs au catalogue", d.items.filter((i) => i.active).length],
    ["Articles dus (collaborateurs × articles)", due.length],
    ["Remis et émargés", count("ok")],
    ["Remis, émargement à faire", count("unsigned")],
    ["À renouveler", count("renew")],
    ["Non remis", count("none")],
    ["Taux d'équipement à jour (%)", pct(count("ok"), due.length)],
    ["Dotations restituées (historique)", d.issues.filter((i) => i.returned_on).length],
    [],
    ["PAR CATÉGORIE"],
    ["Catégorie", "Articles dus", "À jour", "À signer", "À renouveler", "Non remis", "Taux à jour (%)"],
  );
  (Object.keys(CATEGORIES) as EquipmentItem["category"][]).forEach((c) => {
    const l = due.filter((x) => x.it.category === c);
    if (!l.length) return;
    const n = (s: string) => l.filter((x) => x.state === s).length;
    k.push([CATEGORIES[c].label, l.length, n("ok"), n("unsigned"), n("renew"), n("none"), pct(n("ok"), l.length)]);
  });

  /* ---- Collaborateurs ---- */
  const people: Cell[][] = [
    ["Nom", "Fonction", "Équipe", "Statut", "Freelance", "Téléphone", "E-mail", "Embauché le", "Ancienneté (ans)", "Poste dans le dépôt", ...SIZE_KINDS.map((s) => s.label), `CP acquis ${d.year}`, "CP pris", "CP restants", "RTT restants", "Récup. restantes", "Notes"],
    ...d.employees
      .slice()
      .sort((a, b) => TEAM_ORDER.indexOf(a.team) - TEAM_ORDER.indexOf(b.team) || a.name.localeCompare(b.name, "fr"))
      .map((e) => {
        const b = bal.get(e.id)!;
        return [
          e.name, e.job_title, TEAMS[e.team], e.active ? "Actif" : "Sorti", yesNo(e.freelance), e.phone, e.email, fmtDate(e.hired_on), seniority(e), ZONE_META[zoneOfEmployee(e)].name,
          ...SIZE_KINDS.map((s) => (e[s.col] as string | null) || ""),
          e.freelance ? null : round1(b.cpAcq), e.freelance ? null : b.cpTaken, e.freelance ? null : round1(b.cpLeft), e.freelance ? null : round1(b.rttLeft), e.freelance ? null : round1(b.recLeft), e.notes,
        ];
      }),
  ];

  /* ---- Tailles (pour commander) ---- */
  const sizes: Cell[][] = [["Nom", "Équipe", ...SIZE_KINDS.map((s) => s.label), "Complet"], ...staff.map((e) => [e.name, TEAMS[e.team], ...SIZE_KINDS.map((s) => (e[s.col] as string | null) || "À renseigner"), yesNo(sizesDone(e))])];

  /* ---- État des dotations ---- */
  const state: Cell[][] = [
    ["Collaborateur", "Équipe", "Article", "Catégorie", "Taille", "Quantité", "Remis le", "Émargé", "Renouvellement le", "État"],
    ...due.map((x) => [
      x.e.name, TEAMS[x.e.team], x.it.name, CATEGORIES[x.it.category].label, x.last?.size || sizeOf(x.e, x.it.sized) || "", x.last?.qty ?? x.it.qty_per_person,
      fmtDate(x.last?.issued_on), x.last ? yesNo(x.last.signed) : "", fmtDate(x.due), ISSUE_STATE[x.state].label,
    ]),
  ];

  /* ---- Historique des dotations ---- */
  const history: Cell[][] = [
    ["Remis le", "Collaborateur", "Équipe", "Article", "Catégorie", "Taille", "Quantité", "Émargé", "Restitué le", "Note"],
    ...d.issues.map((i) => {
      const e = empById.get(i.employee_id), it = itemById.get(i.item_id);
      return [fmtDate(i.issued_on), e?.name || "?", e ? TEAMS[e.team] : "", it?.name || "?", it ? CATEGORIES[it.category].label : "", i.size, i.qty, yesNo(i.signed), fmtDate(i.returned_on), i.note];
    }),
  ];

  /* ---- Besoins : articles non remis ou à renouveler, regroupés par taille ---- */
  const need = new Map<string, { it: EquipmentItem; size: string; qty: number; who: string[] }>();
  due
    .filter((x) => x.state === "none" || x.state === "renew")
    .forEach((x) => {
      const size = sizeOf(x.e, x.it.sized) || (x.it.sized ? "Taille à renseigner" : "Taille unique");
      const key = x.it.id + "|" + size;
      const n = need.get(key) || { it: x.it, size, qty: 0, who: [] };
      n.qty += x.it.qty_per_person;
      n.who.push(x.e.name);
      need.set(key, n);
    });
  const order: Cell[][] = [["Article", "Catégorie", "Taille", "Quantité à prévoir", "Pour"], ...[...need.values()].sort((a, b) => a.it.name.localeCompare(b.it.name, "fr") || a.size.localeCompare(b.size)).map((n) => [n.it.name, CATEGORIES[n.it.category].label, n.size, n.qty, n.who.join(", ")])];

  /* ---- Catalogue ---- */
  const catalog: Cell[][] = [
    ["Article", "Catégorie", "Norme", "Selon la taille", "Quantité par personne", "Renouvellement (mois)", "Pour", "Actif"],
    ...d.items.map((i) => [i.name, CATEGORIES[i.category].label, i.norm, i.sized ? SIZE_KINDS.find((s) => s.k === i.sized)?.label : "Non", i.qty_per_person, i.renewal_months, i.teams?.length ? i.teams.map((g) => TEAMS[g as keyof typeof TEAMS] || g).join(", ") : "Toutes les équipes", yesNo(i.active)]),
  ];

  return [
    { name: "Indicateurs", rows: k, widths: [38, 12, 16, 12, 24, 22, 20] },
    { name: "Collaborateurs", rows: people, freeze: 1 },
    { name: "Tailles", rows: sizes, freeze: 1 },
    { name: "État des dotations", rows: state, freeze: 1 },
    { name: "Besoins de commande", rows: order, freeze: 1 },
    { name: "Historique dotations", rows: history, freeze: 1 },
    { name: "Catalogue", rows: catalog, freeze: 1 },
  ];
}
