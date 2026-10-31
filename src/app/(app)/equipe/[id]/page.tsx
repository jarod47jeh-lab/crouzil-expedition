import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAudit, getErrors, getLeaves, getMarks } from "@/lib/data";
import { balances } from "@/lib/domain/conges";
import type { Employee } from "@/lib/types";
import { EmployeeDetail } from "./view";

export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ y?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const year = Number(sp.y) || new Date().getFullYear();
  const sb = await createClient();
  const { data } = await sb.from("employees").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const emp = data as Employee;
  const [reqs, marks, errors, audit] = await Promise.all([
    getLeaves(sb, `${year}-01-01`, `${year}-12-31`),
    getMarks(sb, `${year}-01-01`, `${year}-12-31`),
    getErrors(sb),
    getAudit(sb, { table: "employees", rowId: id, limit: 30 }),
  ]);
  const mine = reqs.filter((r) => r.employee_id === id);
  const first = emp.name.split(" ")[0].toLowerCase();
  const linked = errors.filter((e) => [e.picker, e.driver, e.other_resp].some((n) => n && (n.toLowerCase() === emp.name.toLowerCase() || n.toLowerCase().split(" ")[0] === first)));
  return (
    <EmployeeDetail
      emp={emp}
      year={year}
      bal={balances(emp, year, reqs, marks)}
      requests={mine}
      marks={marks.filter((m) => m.employee_id === id)}
      errors={linked}
      audit={audit}
    />
  );
}
