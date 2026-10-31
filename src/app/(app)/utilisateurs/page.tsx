import { createClient } from "@/lib/supabase/server";
import { getMembers } from "@/lib/data";
import { UsersView } from "./view";

export const metadata = { title: "Utilisateurs" };

export default async function UsersPage() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return <UsersView members={await getMembers(sb)} me={user!.id} canInvite={!!process.env.SUPABASE_SERVICE_ROLE_KEY} />;
}
