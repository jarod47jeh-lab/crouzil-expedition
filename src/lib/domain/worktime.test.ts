/* Tests du moteur « Temps de travail » : cas A, B et C de la consigne, plus la simulation.
   Lancer : node --test src/lib/domain/worktime.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDay, fmtDur, maxClients, parseDuration, parseTime, simulateTour, type DayInput } from "./worktime.ts";

const t = (s: string) => parseTime(s)!;
const d = (s: string) => parseDuration(s)!;
const base = (over: Partial<DayInput>): DayInput => ({
  category: "lourd",
  badgeIn: t("5:00"),
  badgeOut: t("13:30"),
  pauses: [],
  tacho: { drive: null, other: null, avail: null, rest: null },
  prevEnd: null,
  weekServiceBefore: null,
  weekDriveBefore: null,
  fortnightDriveBefore: null,
  extendedDaysBefore: null,
  reducedRestsBefore: null,
  ...over,
});

test("A : journée type avec pause libre de 30 min = Conforme", () => {
  const r = checkDay(
    base({
      pauses: [{ start: t("9:20"), end: t("9:50"), free: true }],
      // conduite : 0h30 + 1h00 + 0h10 + 0h20 + 1h00 = 3h00 ; autres tâches : 0h30 + 2h20 + 1h40 + 0h20 + 0h10 = 5h00
      tacho: { drive: d("3:00"), other: d("5:00"), avail: 0, rest: d("0:30") },
    }),
  );
  assert.equal(fmtDur(r.presence), "8h30");
  assert.equal(fmtDur(r.drive!), "3h00");
  assert.equal(fmtDur(r.service), "8h00");
  assert.equal(fmtDur(r.pausesValid), "0h30");
  assert.equal(r.gap, 0);
  assert.equal(r.status, "Conforme", JSON.stringify(r.alerts));
});

test("B : même journée sans pause = Non conforme (P1 et P2)", () => {
  const r = checkDay(base({ badgeOut: t("13:00"), tacho: { drive: d("3:00"), other: d("5:00"), avail: 0, rest: 0 } }));
  assert.equal(fmtDur(r.longestWork), "8h00");
  assert.equal(r.status, "Non conforme");
  const rules = r.alerts.filter((a) => a.level === "bad").map((a) => a.rule);
  assert.ok(rules.includes("P1"), "P1 attendu");
  assert.ok(rules.includes("P2"), "P2 attendu");
  assert.match(r.alerts.find((a) => a.rule === "P1")!.action, /avant 11h00/);
});

test("C : plus de 9 h de service avec une seule pause de 30 min = pause de 45 min requise", () => {
  const r = checkDay(base({ badgeOut: t("15:00"), pauses: [{ start: t("10:00"), end: t("10:30"), free: true }] }));
  assert.ok(r.service > 540);
  const p2 = r.alerts.find((a) => a.rule === "P2" && a.level === "bad");
  assert.ok(p2, "alerte P2 attendue");
  assert.match(p2!.message, /Pause de 45 min requise/);
  assert.equal(r.status, "Non conforme");
});

test("une pause non libre compte comme du travail", () => {
  const r = checkDay(base({ pauses: [{ start: t("9:20"), end: t("9:50"), free: false }] }));
  assert.equal(fmtDur(r.service), "8h30");
  assert.equal(r.status, "Non conforme");
});

test("une pause de moins de 15 min ne coupe pas le travail", () => {
  const r = checkDay(base({ badgeOut: t("12:00"), pauses: [{ start: t("8:00"), end: t("8:10"), free: true }] }));
  assert.equal(fmtDur(r.longestWork), "7h00");
});

test("repos quotidien réduit puis insuffisant (plus de 3,5 t)", () => {
  assert.equal(checkDay(base({ prevEnd: t("19:00"), pauses: [{ start: t("9:20"), end: t("9:50"), free: true }] })).status, "À surveiller");
  assert.equal(checkDay(base({ prevEnd: t("21:00"), pauses: [{ start: t("9:20"), end: t("9:50"), free: true }] })).status, "Non conforme");
});

test("écart badgeuse / tachygraphe au-delà de 15 min", () => {
  const r = checkDay(base({ pauses: [{ start: t("9:20"), end: t("9:50"), free: true }], tacho: { drive: d("3:00"), other: d("4:30"), avail: 0, rest: d("0:30") } }));
  assert.ok(r.alerts.some((a) => a.rule === "P9"));
  assert.equal(r.status, "À surveiller");
});

test("simulation : 12 clients, la pause tombe avant la limite et vers le milieu", () => {
  const plan = simulateTour({ category: "lourd", badgeIn: t("5:00"), departure: t("5:30"), clients: 12, perClient: 20, between: 10, returnAt: t("13:00"), unload: 20, closing: 10 });
  const pause = plan.steps.find((s) => s.kind === "pause")!;
  assert.ok(pause, "une pause doit être placée");
  assert.ok(pause.start <= t("10:30"), "pause avant 10h30 (6 h moins la marge)");
  assert.ok(plan.pauseAfter! >= 3 && plan.pauseAfter! <= 9, "pause vers le milieu des clients");
  assert.ok(plan.lastDeliveryEnd! <= t("12:00"));
  assert.equal(plan.status, "Conforme", JSON.stringify([...plan.day.alerts, ...plan.extraAlerts]));
  assert.ok(maxClients({ category: "lourd", badgeIn: t("5:00"), departure: t("5:30"), clients: 12, perClient: 20, between: 10, returnAt: t("13:00"), unload: 20, closing: 10 }) >= 12);
});

test("simulation : trop de clients pour finir avant 12h00", () => {
  const input = { category: "lourd" as const, badgeIn: t("5:00"), departure: t("5:30"), clients: 30, perClient: 20, between: 10, returnAt: null, unload: 20, closing: 10 };
  const plan = simulateTour(input);
  assert.equal(plan.status, "Non conforme");
  assert.ok(plan.extraAlerts.some((a) => a.rule === "P10"));
  const max = maxClients(input);
  assert.ok(max >= 10 && max < 30, `max = ${max}`);
  assert.notEqual(simulateTour({ ...input, clients: max }).status, "Non conforme");
});
