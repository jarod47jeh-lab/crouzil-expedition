const pad = (n: number) => String(n).padStart(2, "0");

/** Date locale -> "AAAA-MM-JJ" */
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "AAAA-MM-JJ" -> Date locale à minuit */
export const parse = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
export const DAYS_SHORT = ["D", "L", "M", "M", "J", "V", "S"];

function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

const HOLI = new Map<number, Set<string>>();
/** Jours fériés français (métropole) */
export function holidays(y: number) {
  let s = HOLI.get(y);
  if (s) return s;
  const e = easter(y);
  s = new Set([
    `${y}-01-01`, iso(addDays(e, 1)), `${y}-05-01`, `${y}-05-08`, iso(addDays(e, 39)), iso(addDays(e, 50)),
    `${y}-07-14`, `${y}-08-15`, `${y}-11-01`, `${y}-11-11`, `${y}-12-25`,
  ]);
  HOLI.set(y, s);
  return s;
}
export const isHoliday = (d: Date) => holidays(d.getFullYear()).has(iso(d));
export const isWorkDay = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6 && !isHoliday(d);
export function workDays(a: Date, b: Date) {
  let n = 0;
  for (let d = new Date(a); d <= b; d = addDays(d, 1)) if (isWorkDay(d)) n++;
  return n;
}
export const nextWorkDay = (d: Date) => {
  let x = addDays(d, 1);
  while (!isWorkDay(x)) x = addDays(x, 1);
  return x;
};
export const prevWorkDay = (d: Date) => {
  let x = addDays(d, -1);
  while (!isWorkDay(x)) x = addDays(x, -1);
  return x;
};

export const fmtDate = (s?: string | null) => (s ? parse(s).toLocaleDateString("fr-FR") : "");
export const fmtShort = (s?: string | null) => (s ? parse(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).replace(".", "") : "");
export const fmtLong = (d: Date) => {
  const s = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const fmtDay = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
export const daysBetween = (a: string, b: Date = today()) => Math.round((b.getTime() - parse(a).getTime()) / 86400000);
export const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export function weekStart(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
