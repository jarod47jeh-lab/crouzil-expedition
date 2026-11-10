import { requireModule } from "@/lib/guard";
import { createClient } from "@/lib/supabase/server";
import { getAssets } from "@/lib/data";
import { ReportView } from "./view";

export const metadata = { title: "Signaler un problème" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ asset?: string }> }) {
  await requireModule("reparations");
  const sp = await searchParams;
  const sb = await createClient();
  const assets = (await getAssets(sb)).filter((a) => a.active);
  return <ReportView assets={assets} preset={sp.asset} />;
}
