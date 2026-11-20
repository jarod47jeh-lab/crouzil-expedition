import { requireModule } from "@/lib/guard";
import { getDayMarksYear, yearRange } from "@/lib/queries";
import { getEmployees, getLeaves, getQualifications } from "@/lib/data";
import { balances } from "@/lib/domain/conges";
import { EquipeView } from "./view";

export const metadata = { title: "Équipe" };

export default async function EquipePage() {
  await requireModule("equipe");
  const year = new Date().getFullYear();
  const [from, to] = yearRange(year);
  const [emps, reqs, marks, q] = await Promise.all([getEmployees(), getLeaves(undefined, from, to), getDayMarksYear(year), getQualifications()]);
  const rows = emps.map((e) => ({ ...e, bal: balances(e, year, reqs, marks) }));
  return <EquipeView rows={rows} year={year} qualTypes={q.types} quals={q.quals} leaves={reqs} marks={marks} />;
}
