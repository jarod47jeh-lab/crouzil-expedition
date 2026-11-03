import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canRead, isAdmin, type ModuleKey, type Perms } from "@/lib/perms";

export async function getPerms(): Promise<Perms & { id: string }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await sb.from("members").select("role,modules").eq("id", user.id).maybeSingle();
  return { id: user.id, role: (data?.role as Perms["role"]) || "reader", modules: (data?.modules as ModuleKey[] | null) ?? null };
}

/** À appeler en tête de page : renvoie vers l'accueil si le menu n'est pas autorisé. */
export async function requireModule(m: ModuleKey | "admin") {
  const p = await getPerms();
  const ok = m === "admin" ? isAdmin(p) : canRead(p, m);
  if (!ok) redirect("/?refus=1");
  return p;
}
