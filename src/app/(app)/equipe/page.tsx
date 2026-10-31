import { getDayMarksYear, yearRange } from "@/lib/queries";
import { getEmployees, getLeaves } from "@/lib/data";
import { balances } from "@/lib/domain/conges";
import { EquipeView } from "./view";

export const metadata = { title: "Équipe" };

export default async function EquipePage() {
  const year = new Date().getFullYear();
  const [from, to] = yearRange(year);
  const [emps, reqs, marks] = await Promise.all([getEmployees(), getLeaves(undefined, from, to), getDayMarksYear(year)]);
  const rows = emps.map((e) => ({ ...e, bal: balances(e, year, reqs, marks) }));
  return <EquipeView rows={rows} year={year} />;
}
