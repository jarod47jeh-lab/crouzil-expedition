import { requireModule } from "@/lib/guard";
import { createClient } from "@/lib/supabase/server";
import { getEmployees, getMembers, getTasks } from "@/lib/data";
import { TasksView } from "./view";

export const metadata = { title: "To do list" };

export default async function TasksPage() {
  await requireModule("taches");
  const sb = await createClient();
  const [tasks, employees, members] = await Promise.all([getTasks(sb), getEmployees(sb, false), getMembers(sb)]);
  const people = [...new Set([...members.map((m) => m.full_name || "").filter(Boolean), ...employees.map((e) => e.name)])].sort((a, b) => a.localeCompare(b, "fr"));
  return <TasksView tasks={tasks} people={people} />;
}
