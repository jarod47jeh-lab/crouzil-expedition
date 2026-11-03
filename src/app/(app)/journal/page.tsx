import { requireModule } from "@/lib/guard";
import { getJournal } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { JournalView } from "./view";

export const metadata = { title: "Journal de bord" };

export default async function JournalPage() {
  await requireModule("journal");
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { data: me } = await sb.from("members").select("full_name,email").eq("id", user!.id).maybeSingle();
  return <JournalView entries={await getJournal(sb)} me={me?.full_name || me?.email?.split("@")[0] || ""} />;
}
