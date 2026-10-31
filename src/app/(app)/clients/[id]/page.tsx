import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAudit, getJustifications } from "@/lib/data";
import type { Client, DeliveryError } from "@/lib/types";
import { ClientDetail } from "./view";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data } = await sb.from("clients").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as Client;
  const [errs, audit, justifs] = await Promise.all([
    sb.from("delivery_errors").select("*").is("deleted_at", null).or(`client_id.eq.${id},client_name.ilike."${c.name.replace(/["\\]/g, "")}"`).order("date", { ascending: false }),
    getAudit(sb, { table: "clients", rowId: id, limit: 20 }),
    getJustifications(sb),
  ]);
  return <ClientDetail client={c} errors={(errs.data || []) as DeliveryError[]} audit={audit} justifs={justifs} />;
}
