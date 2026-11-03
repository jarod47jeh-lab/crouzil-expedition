import { requireModule } from "@/lib/guard";
import { createClient } from "@/lib/supabase/server";
import { getClients, getMembers, getNotes } from "@/lib/data";
import { NotesView } from "./view";

export const metadata = { title: "Remontées livraison" };

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ tab?: string; client?: string }> }) {
  const p = await requireModule("remontees");
  const sp = await searchParams;
  const sb = await createClient();
  const [notes, clients, members] = await Promise.all([getNotes(sb), getClients(sb), getMembers(sb)]);
  return (
    <NotesView
      tab={sp.tab === "toutes" ? "toutes" : "avenir"}
      notes={notes}
      clients={clients.map((c) => ({ id: c.id, name: c.name, route: c.route }))}
      authors={Object.fromEntries(members.map((m) => [m.id, m.full_name || m.email]))}
      me={p.id}
      newForClient={sp.client}
    />
  );
}
