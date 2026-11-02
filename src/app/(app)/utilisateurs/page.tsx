import { createClient } from "@/lib/supabase/server";
import { getMembers } from "@/lib/data";
import { UsersView } from "./view";

export const metadata = { title: "Utilisateurs" };

export default async function UsersPage() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const members = await getMembers(sb);
  const me = members.find((m) => m.id === user!.id);
  return <UsersView members={members} me={user!.id} myName={me?.full_name || me?.email.split("@")[0] || ""} canInvite={!!process.env.SUPABASE_SERVICE_ROLE_KEY} />;
}
