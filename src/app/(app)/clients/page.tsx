import { createClient } from "@/lib/supabase/server";
import { getClients, getErrors } from "@/lib/data";
import { ClientsView } from "./view";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const sb = await createClient();
  const [clients, errors] = await Promise.all([getClients(sb), getErrors(sb)]);
  const stats = new Map<string, { n: number; last: string | null; n90: number }>();
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  for (const c of clients) stats.set(c.id, { n: 0, last: null, n90: 0 });
  for (const e of errors) {
    const id = e.client_id || clients.find((c) => c.name.toUpperCase() === e.client_name.toUpperCase())?.id;
    if (!id || !stats.has(id)) continue;
    const s = stats.get(id)!;
    s.n++;
    if (e.date >= since) s.n90++;
    if (!s.last || e.date > s.last) s.last = e.date;
  }
  return <ClientsView rows={clients.map((c) => ({ ...c, ...stats.get(c.id)! }))} />;
}
