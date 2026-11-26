/* Temps de travail des chauffeurs-livreurs (transport routier de marchandises).
   Moteur pur, sans dépendance : contrôle d'une journée réelle (badgeuse + tachygraphe)
   et simulation d'une tournée. Toutes les heures sont en minutes depuis minuit,
   toutes les durées en minutes. */

// ---------------------------------------------------------------- paramètres

export interface WorkParams {
  /** P1 travail consécutif max sans pause */
  maxConsecutive: number;
  /** P2 pause minimale selon le temps de travail */
  pauseFrom: number; // 6 h : à partir de là, pause courte
  pauseShort: number; // 30 min
  pauseLongFrom: number; // 9 h : au-delà, pause longue
  pauseLong: number; // 45 min
  pauseSlice: number; // tranches d'au moins 15 min
  /** P3 véhicules de plus de 3,5 t */
  driveBeforeBreak: number; // 4 h 30
  driveBreak: number; // 45 min
  driveBreakFirst: number; // 15 min puis
  driveBreakSecond: number; // 30 min
  /** P4 conduite */
  driveDay: number; // 9 h
  driveDayExtended: number; // 10 h
  driveDayExtendedPerWeek: number; // 2
  driveWeek: number; // 56 h
  driveFortnight: number; // 90 h
  /** P5 temps de service quotidien */
  serviceDay: number; // 12 h
  /** P6 temps de service hebdomadaire */
  serviceWeekHeavy: number; // 52 h
  serviceWeekLight: number; // 48 h
  /** P7 seuil des heures supplémentaires */
  overtimeWeek: number; // 39 h
  /** P8 repos quotidien */
  restHeavy: number; // 11 h
  restHeavyReduced: number; // 9 h
  restHeavyReducedMax: number; // 3 fois
  restLight: number; // 10 h
  /** P9 tolérance badgeuse / tachygraphe */
  badgeTolerance: number; // 15 min
  /** P10 fenêtre sans livraison client */
  noDeliveryFrom: number; // 12h00
  noDeliveryTo: number; // 14h00
  /** P11 marge de sécurité de la pause */
  pauseMargin: number; // 30 min
}

export const DEFAULT_PARAMS: WorkParams = {
  maxConsecutive: 360,
  pauseFrom: 360,
  pauseShort: 30,
  pauseLongFrom: 540,
  pauseLong: 45,
  pauseSlice: 15,
  driveBeforeBreak: 270,
  driveBreak: 45,
  driveBreakFirst: 15,
  driveBreakSecond: 30,
  driveDay: 540,
  driveDayExtended: 600,
  driveDayExtendedPerWeek: 2,
  driveWeek: 3360,
  driveFortnight: 5400,
  serviceDay: 720,
  serviceWeekHeavy: 3120,
  serviceWeekLight: 2880,
  overtimeWeek: 2340,
  restHeavy: 660,
  restHeavyReduced: 540,
  restHeavyReducedMax: 3,
  restLight: 600,
  badgeTolerance: 15,
  noDeliveryFrom: 720,
  noDeliveryTo: 840,
  pauseMargin: 30,
};

export type RuleKey = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8" | "P9" | "P10" | "P11";

export interface Rule {
  title: string;
  text: string;
  ref: string;
  /** false = choix interne de l'entreprise, pas une obligation légale */
  legal: boolean;
}

export const DEFAULT_RULES: Record<RuleKey, Rule> = {
  P1: { title: "Travail consécutif", text: "Pas plus de 6 h de travail d'affilée sans pause.", ref: "Code des transports, L. 3312-2", legal: true },
  P2: {
    title: "Pause minimale",
    text: "30 min de pause si le temps de travail est de 6 à 9 h, 45 min au-delà de 9 h, par tranches d'au moins 15 min.",
    ref: "Code des transports, L. 3312-2",
    legal: true,
  },
  P3: {
    title: "Pause de conduite (plus de 3,5 t)",
    text: "45 min de pause après 4 h 30 de conduite cumulée, fractionnable en 15 min puis 30 min. Un chargement ou un déchargement n'est pas une pause.",
    ref: "Règlement CE 561/2006",
    legal: true,
  },
  P4: { title: "Durée de conduite", text: "9 h par jour (10 h deux fois par semaine), 56 h par semaine, 90 h sur deux semaines.", ref: "Règlement CE 561/2006", legal: true },
  P5: { title: "Temps de service quotidien", text: "12 h au maximum par jour.", ref: "Code des transports, D. 3312-51", legal: true },
  P6: {
    title: "Temps de service hebdomadaire",
    text: "52 h au maximum pour les autres personnels roulants, 48 h pour les véhicules de 3,5 t et moins.",
    ref: "Code des transports, D. 3312-50",
    legal: true,
  },
  P7: { title: "Heures supplémentaires", text: "Au-delà de 39 h de temps de service par semaine.", ref: "Code des transports, D. 3312-45", legal: true },
  P8: {
    title: "Repos quotidien",
    text: "11 h, réductible à 9 h trois fois au plus entre deux repos hebdomadaires, pour plus de 3,5 t ; 10 h pour 3,5 t et moins.",
    ref: "Code des transports, D. 3312-53",
    legal: true,
  },
  P9: { title: "Écart badgeuse et tachygraphe", text: "Écart toléré de 15 min entre la présence badgée et le total du tachygraphe.", ref: "Choix interne, non légal", legal: false },
  P10: { title: "Fenêtre sans livraison", text: "Pas de livraison client entre 12h00 et 14h00.", ref: "Contrainte CHR, interne", legal: false },
  P11: { title: "Marge de sécurité de la pause", text: "Alerte si la pause n'est pas prise 30 min avant la limite des 6 h.", ref: "Choix interne", legal: false },
};

export type ParamUnit = "duree" | "heure" | "nombre";
/** Champs modifiables par l'administrateur, rangés par règle */
export const PARAM_FIELDS: { key: keyof WorkParams; rule: RuleKey; label: string; unit: ParamUnit }[] = [
  { key: "maxConsecutive", rule: "P1", label: "Travail consécutif max", unit: "duree" },
  { key: "pauseFrom", rule: "P2", label: "Pause obligatoire à partir de", unit: "duree" },
  { key: "pauseShort", rule: "P2", label: "Pause courte", unit: "duree" },
  { key: "pauseLongFrom", rule: "P2", label: "Pause longue au-delà de", unit: "duree" },
  { key: "pauseLong", rule: "P2", label: "Pause longue", unit: "duree" },
  { key: "pauseSlice", rule: "P2", label: "Tranche minimale", unit: "duree" },
  { key: "driveBeforeBreak", rule: "P3", label: "Conduite cumulée avant pause", unit: "duree" },
  { key: "driveBreak", rule: "P3", label: "Pause de conduite", unit: "duree" },
  { key: "driveBreakFirst", rule: "P3", label: "Fractionnement : 1re partie", unit: "duree" },
  { key: "driveBreakSecond", rule: "P3", label: "Fractionnement : 2e partie", unit: "duree" },
  { key: "driveDay", rule: "P4", label: "Conduite par jour", unit: "duree" },
  { key: "driveDayExtended", rule: "P4", label: "Conduite par jour, prolongée", unit: "duree" },
  { key: "driveDayExtendedPerWeek", rule: "P4", label: "Prolongations par semaine", unit: "nombre" },
  { key: "driveWeek", rule: "P4", label: "Conduite par semaine", unit: "duree" },
  { key: "driveFortnight", rule: "P4", label: "Conduite sur deux semaines", unit: "duree" },
  { key: "serviceDay", rule: "P5", label: "Temps de service par jour", unit: "duree" },
  { key: "serviceWeekHeavy", rule: "P6", label: "Par semaine, plus de 3,5 t", unit: "duree" },
  { key: "serviceWeekLight", rule: "P6", label: "Par semaine, 3,5 t et moins", unit: "duree" },
  { key: "overtimeWeek", rule: "P7", label: "Seuil hebdomadaire", unit: "duree" },
  { key: "restHeavy", rule: "P8", label: "Repos, plus de 3,5 t", unit: "duree" },
  { key: "restHeavyReduced", rule: "P8", label: "Repos réduit, plus de 3,5 t", unit: "duree" },
  { key: "restHeavyReducedMax", rule: "P8", label: "Réductions max entre deux repos hebdomadaires", unit: "nombre" },
  { key: "restLight", rule: "P8", label: "Repos, 3,5 t et moins", unit: "duree" },
  { key: "badgeTolerance", rule: "P9", label: "Tolérance d'écart", unit: "duree" },
  { key: "noDeliveryFrom", rule: "P10", label: "Début de la fenêtre", unit: "heure" },
  { key: "noDeliveryTo", rule: "P10", label: "Fin de la fenêtre", unit: "heure" },
  { key: "pauseMargin", rule: "P11", label: "Marge avant la limite", unit: "duree" },
];

export const mergeParams = (stored: unknown): WorkParams => {
  const out = { ...DEFAULT_PARAMS };
  if (stored && typeof stored === "object") {
    for (const k of Object.keys(DEFAULT_PARAMS) as (keyof WorkParams)[]) {
      const v = (stored as Record<string, unknown>)[k];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
    }
  }
  return out;
};

export const mergeRules = (stored: unknown): Record<RuleKey, Rule> => {
  const out = { ...DEFAULT_RULES };
  if (stored && typeof stored === "object") {
    for (const k of Object.keys(DEFAULT_RULES) as RuleKey[]) {
      const v = (stored as Record<string, Partial<Rule>>)[k];
      if (v && typeof v === "object") out[k] = { ...DEFAULT_RULES[k], ...pickText(v) };
    }
  }
  return out;
};
const pickText = (v: Partial<Rule>) => {
  const r: Partial<Rule> = {};
  if (typeof v.title === "string" && v.title.trim()) r.title = v.title.trim();
  if (typeof v.text === "string" && v.text.trim()) r.text = v.text.trim();
  if (typeof v.ref === "string" && v.ref.trim()) r.ref = v.ref.trim();
  return r;
};

// ---------------------------------------------------------------- heures

/** « 5:00 », « 05h00 », « 5h », « 13.30 » -> minutes ; null si vide ou invalide */
export function parseTime(s: string | null | undefined): number | null {
  if (s == null) return null;
  const m = String(s).trim().toLowerCase().match(/^(\d{1,2})\s*(?:[:h.]\s*(\d{1,2})?)?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mn = m[2] ? Number(m[2]) : 0;
  if (h > 47 || mn > 59) return null;
  return h * 60 + mn;
}
/** Durée « 3:00 », « 3h », « 0h30 », « 45 » (minutes si un seul nombre > 23) -> minutes */
export function parseDuration(s: string | null | undefined): number | null {
  if (s == null || String(s).trim() === "") return null;
  const t = String(s).trim().toLowerCase();
  if (/^\d+\s*(min|mn)$/.test(t)) return Number(t.replace(/\D/g, ""));
  if (/^\d+$/.test(t)) return Number(t) > 23 ? Number(t) : Number(t) * 60;
  return parseTime(t);
}
/** 570 -> « 9h30 » ; heures au-delà de minuit ramenées sur 24 h */
export const fmtClock = (m: number) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${Math.floor(x / 60)}h${String(x % 60).padStart(2, "0")}`;
};
/** 510 -> « 8h30 », 30 -> « 0h30 », -15 -> « -0h15 » */
export const fmtDur = (m: number) => {
  const neg = m < 0;
  const x = Math.abs(Math.round(m));
  return `${neg ? "-" : ""}${Math.floor(x / 60)}h${String(x % 60).padStart(2, "0")}`;
};
/** Pour les messages : 30 -> « 30 min », 90 -> « 1h30 », 360 -> « 6 h » */
export const fmtSpan = (m: number) => (m < 60 ? `${m} min` : m % 60 ? fmtDur(m) : `${m / 60} h`);

// ---------------------------------------------------------------- contrôle d'une journée

export type Category = "lourd" | "leger"; // plus de 3,5 t / 3,5 t et moins
export interface PauseInput {
  start: number;
  end: number;
  /** pause réellement libre (le chauffeur dispose de son temps) */
  free: boolean;
}
export interface DayInput {
  category: Category;
  badgeIn: number;
  badgeOut: number;
  pauses: PauseInput[];
  /** tachygraphe, en minutes ; null = non renseigné */
  tacho: { drive: number | null; other: number | null; avail: number | null; rest: number | null };
  /** heure de fin de la veille (repos quotidien) */
  prevEnd: number | null;
  /** cumuls de la semaine AVANT ce jour */
  weekServiceBefore: number | null;
  weekDriveBefore: number | null;
  fortnightDriveBefore: number | null;
  /** nombre de journées de conduite prolongées (10 h) déjà faites cette semaine */
  extendedDaysBefore: number | null;
  /** nombre de repos réduits déjà pris depuis le dernier repos hebdomadaire */
  reducedRestsBefore: number | null;
}

export type Level = "bad" | "warn" | "info";
export interface Alert {
  rule: RuleKey;
  level: Level;
  message: string;
  action: string;
}
export type Status = "Conforme" | "À surveiller" | "Non conforme";
export interface Segment {
  start: number;
  end: number;
  kind: "travail" | "pause" | "pause-non-libre" | "depassement";
}
export interface DayResult {
  presence: number;
  service: number;
  pausesValid: number;
  longestWork: number;
  pauseRequired: number;
  firstPauseDeadline: number;
  drive: number | null;
  tachoTotal: number | null;
  gap: number | null;
  rest: number | null;
  weekService: number | null;
  overtime: number | null;
  status: Status;
  alerts: Alert[];
  segments: Segment[];
}

const sortPauses = (p: PauseInput[]) => p.filter((x) => x.end > x.start).sort((a, b) => a.start - b.start);

export function checkDay(input: DayInput, P: WorkParams = DEFAULT_PARAMS, R: Record<RuleKey, Rule> = DEFAULT_RULES): DayResult {
  const alerts: Alert[] = [];
  const push = (rule: RuleKey, level: Level, message: string, action: string) => alerts.push({ rule, level, message, action });
  void R;

  const bIn = input.badgeIn;
  let bOut = input.badgeOut;
  if (bOut < bIn) bOut += 1440; // sortie après minuit
  // pauses ramenées dans la journée badgée (après minuit si besoin)
  const pauses = sortPauses(
    input.pauses.map((p) => {
      let s = p.start;
      let e = p.end;
      if (s < bIn) s += 1440;
      if (e < s) e += 1440;
      return { start: Math.max(s, bIn), end: Math.min(e, bOut), free: p.free };
    }),
  );
  // 1. présence
  const presence = bOut - bIn;
  // 2. temps de service : seules les pauses libres d'au moins une tranche coupent le travail
  const cuts = pauses.filter((p) => p.free && p.end - p.start >= P.pauseSlice);
  const pausesValid = cuts.reduce((n, p) => n + (p.end - p.start), 0);
  const service = presence - pausesValid;

  // 3. plus longue période de travail consécutive
  const periods: [number, number][] = [];
  let cur = bIn;
  for (const c of cuts) {
    if (c.start > cur) periods.push([cur, c.start]);
    cur = Math.max(cur, c.end);
  }
  if (bOut > cur) periods.push([cur, bOut]);
  const longestWork = periods.reduce((m, [a, b]) => Math.max(m, b - a), 0);

  // frise
  const segments: Segment[] = [];
  let t = bIn;
  for (const p of pauses) {
    if (p.start > t) segments.push(...workSegs(t, p.start, periods, P));
    const valid = p.free && p.end - p.start >= P.pauseSlice;
    segments.push({ start: p.start, end: p.end, kind: valid ? "pause" : "pause-non-libre" });
    t = Math.max(t, p.end);
  }
  if (bOut > t) segments.push(...workSegs(t, bOut, periods, P));

  const firstPauseDeadline = bIn + P.maxConsecutive;
  if (longestWork > P.maxConsecutive) {
    const over = periods.find(([a, b]) => b - a > P.maxConsecutive)!;
    push(
      "P1",
      "bad",
      `${fmtDur(longestWork)} de travail d'affilée, au-delà de ${fmtSpan(P.maxConsecutive)}.`,
      `Placer une pause avant ${fmtClock(over[0] + P.maxConsecutive)}.`,
    );
  } else if (service > P.pauseFrom) {
    // P11 : la pause arrive-t-elle avec assez de marge ?
    const tight = periods.find(([a, b]) => b - a > P.maxConsecutive - P.pauseMargin && b - a <= P.maxConsecutive);
    if (tight)
      push(
        "P11",
        "warn",
        `Pause prise à ${fmtClock(tight[1])}, moins de ${fmtSpan(P.pauseMargin)} avant la limite de ${fmtClock(tight[0] + P.maxConsecutive)}.`,
        `Prendre la pause avant ${fmtClock(tight[0] + P.maxConsecutive - P.pauseMargin)}.`,
      );
  }

  // 4. pause requise (P2)
  const pauseRequired = service > P.pauseLongFrom ? P.pauseLong : service >= P.pauseFrom ? P.pauseShort : 0;
  if (pauseRequired && pausesValid < pauseRequired) {
    const missing = pauseRequired - pausesValid;
    const nonFree = pauses.filter((p) => !p.free).length;
    push(
      "P2",
      "bad",
      `Pause de ${fmtSpan(pauseRequired)} requise pour ${fmtDur(service)} de temps de service : ${pausesValid ? fmtSpan(pausesValid) + " seulement" : "aucune pause libre"}.`,
      pausesValid
        ? `Ajouter ${fmtSpan(missing)} de pause libre, en tranche d'au moins ${fmtSpan(P.pauseSlice)}.`
        : `Placer une pause de ${fmtSpan(pauseRequired)} avant ${fmtClock(firstPauseDeadline)}.${nonFree ? " Une pause non libre compte comme du travail." : ""}`,
    );
  }
  const short = pauses.filter((p) => p.free && p.end - p.start < P.pauseSlice);
  if (short.length)
    push(
      "P2",
      "info",
      `${short.length > 1 ? `${short.length} pauses de moins de ${fmtSpan(P.pauseSlice)} ne comptent pas` : `Une pause de moins de ${fmtSpan(P.pauseSlice)} ne compte pas`} : elles restent du travail.`,
      `Regrouper les pauses en tranches d'au moins ${fmtSpan(P.pauseSlice)}.`,
    );

  // 5. conduite (P3, P4)
  const drive = input.tacho.drive;
  if (drive != null) {
    if (input.category === "lourd" && drive > P.driveBeforeBreak) {
      const ok = hasDriveBreak(cuts, P);
      if (!ok)
        push(
          "P3",
          "bad",
          `${fmtDur(drive)} de conduite sans pause de conduite de ${fmtSpan(P.driveBreak)}.`,
          `Prévoir ${fmtSpan(P.driveBreak)} de pause (ou ${fmtSpan(P.driveBreakFirst)} puis ${fmtSpan(P.driveBreakSecond)}) avant ${fmtSpan(P.driveBeforeBreak)} de conduite cumulée. Un déchargement n'est pas une pause.`,
        );
    }
    const ext = input.extendedDaysBefore ?? 0;
    if (drive > P.driveDayExtended) push("P4", "bad", `${fmtDur(drive)} de conduite, au-delà de ${fmtSpan(P.driveDayExtended)}.`, `Réduire la conduite du jour sous ${fmtSpan(P.driveDay)}.`);
    else if (drive > P.driveDay) {
      if (ext >= P.driveDayExtendedPerWeek)
        push("P4", "bad", `${fmtDur(drive)} de conduite alors que les ${P.driveDayExtendedPerWeek} journées prolongées de la semaine sont déjà prises.`, `Ramener la conduite sous ${fmtSpan(P.driveDay)}.`);
      else push("P4", "warn", `Journée de conduite prolongée (${fmtDur(drive)}), possible ${P.driveDayExtendedPerWeek} fois par semaine.`, `Vérifier le nombre de journées prolongées de la semaine.`);
    }
    if (input.weekDriveBefore != null && input.weekDriveBefore + drive > P.driveWeek)
      push("P4", "bad", `${fmtDur(input.weekDriveBefore + drive)} de conduite sur la semaine, au-delà de ${fmtSpan(P.driveWeek)}.`, `Alléger la conduite des prochains jours.`);
    if (input.fortnightDriveBefore != null && input.fortnightDriveBefore + drive > P.driveFortnight)
      push("P4", "bad", `${fmtDur(input.fortnightDriveBefore + drive)} de conduite sur deux semaines, au-delà de ${fmtSpan(P.driveFortnight)}.`, `Alléger la conduite de la semaine en cours.`);
  }

  // P5 temps de service quotidien
  if (service > P.serviceDay) push("P5", "bad", `${fmtDur(service)} de temps de service, au-delà de ${fmtSpan(P.serviceDay)}.`, `Terminer la journée avant ${fmtClock(bIn + P.serviceDay + pausesValid)}.`);

  // 6. croisement badgeuse / tachygraphe
  const tk = input.tacho;
  const known = [tk.drive, tk.other, tk.avail, tk.rest].filter((x): x is number => x != null);
  const tachoTotal = known.length ? known.reduce((a, b) => a + b, 0) : null;
  const gap = tachoTotal == null ? null : tachoTotal - presence;
  if (gap != null && Math.abs(gap) > P.badgeTolerance)
    push(
      "P9",
      "warn",
      `Écart de ${fmtDur(Math.abs(gap))} entre la présence badgée (${fmtDur(presence)}) et le tachygraphe (${fmtDur(tachoTotal!)}).`,
      gap < 0 ? `Vérifier les activités non saisies au tachygraphe (prise de service, clôture).` : `Vérifier les badges d'entrée et de sortie.`,
    );
  if (tk.rest != null) {
    if (pausesValid > 0 && tk.rest === 0)
      push("P9", "warn", `Pause déclarée (${fmtDur(pausesValid)}) mais aucun temps « pause/lit » au tachygraphe.`, `Faire passer le sélecteur du tachygraphe sur « lit » pendant la pause.`);
    if (pausesValid === 0 && tk.rest > 0)
      push("P9", "warn", `${fmtDur(tk.rest)} de « pause/lit » au tachygraphe sans pause libre déclarée.`, `Déclarer la pause, ou corriger le sélecteur du tachygraphe.`);
  }

  // 7. repos quotidien (P8)
  let rest: number | null = null;
  if (input.prevEnd != null) {
    rest = bIn + 1440 - input.prevEnd;
    if (rest > 1440) rest -= 1440;
    if (input.category === "lourd") {
      const used = input.reducedRestsBefore ?? 0;
      if (rest < P.restHeavyReduced)
        push("P8", "bad", `${fmtDur(rest)} de repos depuis la veille, sous ${fmtSpan(P.restHeavyReduced)}.`, `Décaler la prise de service à ${fmtClock(input.prevEnd + P.restHeavy)} (ou ${fmtClock(input.prevEnd + P.restHeavyReduced)} en repos réduit).`);
      else if (rest < P.restHeavy) {
        if (used >= P.restHeavyReducedMax)
          push("P8", "bad", `Repos réduit (${fmtDur(rest)}) alors que les ${P.restHeavyReducedMax} réductions sont déjà prises.`, `Décaler la prise de service à ${fmtClock(input.prevEnd + P.restHeavy)}.`);
        else push("P8", "warn", `Repos réduit à ${fmtDur(rest)} (${fmtSpan(P.restHeavy)} normalement), possible ${P.restHeavyReducedMax} fois entre deux repos hebdomadaires.`, `Compter cette réduction.`);
      }
    } else if (rest < P.restLight)
      push("P8", "bad", `${fmtDur(rest)} de repos depuis la veille, sous ${fmtSpan(P.restLight)}.`, `Décaler la prise de service à ${fmtClock(input.prevEnd + P.restLight)}.`);
  }

  // P6, P7 semaine
  let weekService: number | null = null;
  let overtime: number | null = null;
  if (input.weekServiceBefore != null) {
    weekService = input.weekServiceBefore + service;
    const cap = input.category === "lourd" ? P.serviceWeekHeavy : P.serviceWeekLight;
    if (weekService > cap) push("P6", "bad", `${fmtDur(weekService)} de temps de service sur la semaine, au-delà de ${fmtSpan(cap)}.`, `Alléger les prochaines journées de ${fmtDur(weekService - cap)}.`);
    overtime = Math.max(0, weekService - P.overtimeWeek);
    if (overtime > 0) push("P7", "info", `${fmtDur(overtime)} d'heures supplémentaires indicatives sur la semaine.`, `À reporter en paie.`);
  }

  const status: Status = alerts.some((a) => a.level === "bad") ? "Non conforme" : alerts.some((a) => a.level === "warn") ? "À surveiller" : "Conforme";
  return { presence, service, pausesValid, longestWork, pauseRequired, firstPauseDeadline, drive, tachoTotal, gap, rest, weekService, overtime, status, alerts, segments };
}

/** Pause de conduite : 45 min d'un bloc, ou une tranche ≥ 15 min suivie d'une tranche ≥ 30 min */
function hasDriveBreak(cuts: PauseInput[], P: WorkParams) {
  if (cuts.some((c) => c.end - c.start >= P.driveBreak)) return true;
  const i = cuts.findIndex((c) => c.end - c.start >= P.driveBreakFirst);
  return i >= 0 && cuts.slice(i + 1).some((c) => c.end - c.start >= P.driveBreakSecond);
}

/** Découpe un morceau de travail : la partie au-delà de la limite P1 passe en « dépassement » */
function workSegs(a: number, b: number, periods: [number, number][], P: WorkParams): Segment[] {
  const per = periods.find(([s, e]) => a >= s && b <= e);
  if (!per) return [{ start: a, end: b, kind: "travail" }];
  const limit = per[0] + P.maxConsecutive;
  if (b <= limit) return [{ start: a, end: b, kind: "travail" }];
  if (a >= limit) return [{ start: a, end: b, kind: "depassement" }];
  return [
    { start: a, end: limit, kind: "travail" },
    { start: limit, end: b, kind: "depassement" },
  ];
}

// ---------------------------------------------------------------- simulation de tournée

export interface TourInput {
  category: Category;
  badgeIn: number;
  departure: number;
  clients: number;
  perClient: number;
  between: number;
  /** heure de retour au dépôt souhaitée (au plus tôt : fin du dernier client + un trajet) */
  returnAt: number | null;
  unload: number;
  closing: number;
}
export type StepKind = "prise" | "trajet" | "client" | "pause" | "retour" | "dechargement" | "cloture";
export interface Step {
  kind: StepKind;
  label: string;
  start: number;
  end: number;
}
export interface TourPlan {
  steps: Step[];
  badgeOut: number;
  pauseAfter: number | null; // pause placée après ce client (0 = avant le premier)
  pause: number;
  lastDeliveryEnd: number | null;
  drive: number;
  day: DayResult;
  extraAlerts: Alert[];
  status: Status;
}

function buildTour(t: TourInput, pauseAfter: number | null, pause: number): Omit<TourPlan, "day" | "extraAlerts" | "status"> {
  const steps: Step[] = [];
  let x = t.badgeIn;
  if (t.departure > x) {
    steps.push({ kind: "prise", label: "Prise de service, chargement", start: x, end: t.departure });
    x = t.departure;
  }
  const addPause = () => {
    if (pause > 0) {
      steps.push({ kind: "pause", label: `Pause libre de ${fmtSpan(pause)}`, start: x, end: x + pause });
      x += pause;
    }
  };
  let drive = 0;
  let lastDeliveryEnd: number | null = null;
  for (let i = 1; i <= t.clients; i++) {
    if (pauseAfter === i - 1) addPause();
    steps.push({ kind: "trajet", label: i === 1 ? "Trajet vers le client 1" : `Trajet vers le client ${i}`, start: x, end: x + t.between });
    x += t.between;
    drive += t.between;
    steps.push({ kind: "client", label: `Client ${i}`, start: x, end: x + t.perClient });
    x += t.perClient;
    lastDeliveryEnd = x;
  }
  if (pauseAfter != null && pauseAfter >= t.clients) addPause();
  const back = Math.max(x + t.between, t.returnAt ?? 0);
  steps.push({ kind: "retour", label: "Retour au dépôt", start: x, end: back });
  drive += back - x;
  x = back;
  if (t.unload > 0) {
    steps.push({ kind: "dechargement", label: "Déchargement du vide", start: x, end: x + t.unload });
    x += t.unload;
  }
  if (t.closing > 0) {
    steps.push({ kind: "cloture", label: "Clôture", start: x, end: x + t.closing });
    x += t.closing;
  }
  return { steps, badgeOut: x, pauseAfter, pause, lastDeliveryEnd, drive };
}

function evaluate(t: TourInput, plan: ReturnType<typeof buildTour>, P: WorkParams): TourPlan {
  const pauseStep = plan.steps.find((s) => s.kind === "pause");
  const day = checkDay(
    {
      category: t.category,
      badgeIn: t.badgeIn,
      badgeOut: plan.badgeOut,
      pauses: pauseStep ? [{ start: pauseStep.start, end: pauseStep.end, free: true }] : [],
      // tachygraphe théorique : tout ce qui n est ni conduite ni pause est « autres tâches »
      tacho: { drive: plan.drive, other: plan.badgeOut - t.badgeIn - plan.drive - plan.pause, avail: 0, rest: plan.pause },
      prevEnd: null,
      weekServiceBefore: null,
      weekDriveBefore: null,
      fortnightDriveBefore: null,
      extendedDaysBefore: null,
      reducedRestsBefore: null,
    },
    P,
  );
  const extraAlerts: Alert[] = [];
  if (plan.lastDeliveryEnd != null && plan.lastDeliveryEnd > P.noDeliveryFrom) {
    extraAlerts.push({
      rule: "P10",
      level: "bad",
      message: `Dernière livraison terminée à ${fmtClock(plan.lastDeliveryEnd)}, dans la fenêtre sans livraison (${fmtClock(P.noDeliveryFrom)} à ${fmtClock(P.noDeliveryTo)}).`,
      action: `Retirer des clients ou partir plus tôt : il faut gagner ${fmtDur(plan.lastDeliveryEnd - P.noDeliveryFrom)}.`,
    });
  }
  // un déchargement n'est pas une pause : rien à faire, la pause est une étape à part
  const all = [...day.alerts, ...extraAlerts];
  const status: Status = all.some((a) => a.level === "bad") ? "Non conforme" : all.some((a) => a.level === "warn") ? "À surveiller" : "Conforme";
  return { ...plan, day, extraAlerts, status };
}

/** Construit la tournée et place au mieux la pause : avant la limite P1 (avec la marge P11), vers le milieu des clients. */
export function simulateTour(t: TourInput, P: WorkParams = DEFAULT_PARAMS): TourPlan {
  // sans pause : faut-il en prévoir une ?
  const bare = evaluate(t, buildTour(t, null, 0), P);
  const need = bare.day.service > P.pauseLongFrom ? P.pauseLong : bare.day.service >= P.pauseFrom ? P.pauseShort : 0;
  const drivePause = t.category === "lourd" && bare.drive > P.driveBeforeBreak ? P.driveBreak : 0;
  const pause = Math.max(need, drivePause);
  if (!pause) return bare;

  // la pause allonge la journée : si elle fait passer au-dessus de 9 h, il faut la pause longue
  const candidates = (len: number) => {
    const limit = t.badgeIn + P.maxConsecutive - P.pauseMargin;
    const mid = Math.round(t.clients / 2);
    const order: number[] = [];
    for (let d = 0; d <= t.clients; d++) {
      if (mid - d >= 0) order.push(mid - d);
      if (d && mid + d <= t.clients) order.push(mid + d);
    }
    let best: TourPlan | null = null;
    for (const k of order) {
      const plan = evaluate(t, buildTour(t, k, len), P);
      const ps = plan.steps.find((s) => s.kind === "pause")!;
      const inTime = ps.start <= limit;
      const rank = (p: TourPlan) => (p.status === "Conforme" ? 0 : p.status === "À surveiller" ? 1 : 2);
      if (inTime && plan.status === "Conforme") return plan;
      if (!best || rank(plan) < rank(best)) best = plan;
    }
    return best!;
  };
  let plan = candidates(pause);
  if (plan.day.service > P.pauseLongFrom && pause < P.pauseLong) plan = candidates(P.pauseLong);
  return plan;
}

/** Nombre maximal de clients tenable en restant conforme (statut « Conforme » ou « À surveiller »).
    Calculé avec un retour au dépôt au plus tôt : l heure de retour imposée ne doit pas pénaliser les petites tournées. */
export function maxClients(t: TourInput, P: WorkParams = DEFAULT_PARAMS, cap = 60): number {
  let best = 0;
  for (let n = 1; n <= cap; n++) {
    if (simulateTour({ ...t, clients: n, returnAt: null }, P).status !== "Non conforme") best = n;
  }
  return best;
}
