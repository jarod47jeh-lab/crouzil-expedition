import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAssets, getAudit } from "@/lib/data";
import type { Asset, Repair } from "@/lib/types";
import { AssetDetail } from "./view";

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data } = await sb.from("assets").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const [repairs, audit, assets] = await Promise.all([
    sb.from("repairs").select("*").eq("asset_id", id).is("deleted_at", null).order("observed_on", { ascending: false }),
    getAudit(sb, { table: "assets", rowId: id, limit: 30 }),
    getAssets(sb),
  ]);
  return <AssetDetail asset={data as Asset} repairs={(repairs.data || []) as Repair[]} audit={audit} assets={assets} />;
}
