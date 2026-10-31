import { createClient } from "@/lib/supabase/server";
import { TrashView } from "./view";

export const metadata = { title: "Corbeille" };

export default async function TrashPage() {
  const sb = await createClient();
  const { data } = await sb.from("trash").select("*").order("deleted_at", { ascending: false });
  const { data: members } = await sb.from("members").select("id,email,full_name");
  return <TrashView rows={(data || []).map((r) => ({ ...r, id: `${r.table_name}:${r.id}`, row_id: r.id, by: members?.find((m) => m.id === r.updated_by)?.full_name || members?.find((m) => m.id === r.updated_by)?.email || "" }))} />;
}
