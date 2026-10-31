import { createClient } from "@/lib/supabase/server";
import { AccountView } from "./view";

export const metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { data } = await sb.from("members").select("full_name,email").eq("id", user!.id).maybeSingle();
  return <AccountView name={data?.full_name || ""} email={data?.email || user!.email || ""} />;
}
