import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAssets, getAudit } from "@/lib/data";
import type { Repair } from "@/lib/types";
import { RepairDetail } from "./view";

export default async function RepairPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data } = await sb.from("repairs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const [assets, audit, photos] = await Promise.all([
    getAssets(sb),
    getAudit(sb, { table: "repairs", rowId: id, limit: 40 }),
    sb.from("repair_photos").select("id,path,created_at").eq("repair_id", id).order("created_at"),
  ]);
  const list = photos.data || [];
  const signed = list.length ? await sb.storage.from("repair-photos").createSignedUrls(list.map((p) => p.path), 3600) : { data: [] };
  const urls = new Map((signed.data || []).map((s) => [s.path, s.signedUrl]));
  return (
    <RepairDetail
      repair={data as Repair}
      assets={assets}
      audit={audit}
      photos={list.map((p) => ({ id: p.id as string, path: p.path as string, url: urls.get(p.path) || "" }))}
    />
  );
}
