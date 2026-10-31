import { createClient } from "@/lib/supabase/server";
import { getClients, getErrors, getJustifications, getSettings, getVolumes } from "@/lib/data";
import { ErrorsView } from "./view";

export const metadata = { title: "Erreurs de livraison" };

export default async function ErrorsPage({ searchParams }: { searchParams: Promise<{ tab?: string; p?: string }> }) {
  const sp = await searchParams;
  const tab = ["dash", "list", "import"].includes(sp.tab || "") ? sp.tab! : "dash";
  const sb = await createClient();
  const [errors, volumes, justifs, settings, clients] = await Promise.all([getErrors(sb), getVolumes(sb), getJustifications(sb), getSettings(sb), getClients(sb)]);
  const last = await sb.from("delivery_errors").select("source,updated_at").not("source", "is", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return <ErrorsView tab={tab} period={sp.p} errors={errors} volumes={volumes} justifs={justifs} settings={settings} clients={clients} lastImport={last.data as { source: string; updated_at: string } | null} />;
}
