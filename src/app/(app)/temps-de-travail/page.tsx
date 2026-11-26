import { getPerms } from "@/lib/guard";
import { createClient } from "@/lib/supabase/server";
import { mergeParams, mergeRules } from "@/lib/domain/worktime";
import { WorktimeView, type Template } from "./view";

export const metadata = { title: "Temps de travail" };

/** Ouvert à tout membre connecté ; seul l'administrateur peut modifier (voir les règles RLS). */
export default async function WorktimePage() {
  await getPerms();
  const sb = await createClient();
  const [settings, templates, drivers] = await Promise.all([
    sb.from("worktime_settings").select("params,rules,verified_on").eq("id", 1).maybeSingle(),
    sb.from("worktime_templates").select("id,name,kind,data").order("name"),
    // la liste des chauffeurs n'est lisible qu'avec le menu Équipe : sinon, saisie libre
    sb.from("employees").select("id,name").eq("team", "chauf").eq("active", true).is("deleted_at", null).order("name"),
  ]);
  return (
    <WorktimeView
      params={mergeParams(settings.data?.params)}
      rules={mergeRules(settings.data?.rules)}
      verifiedOn={settings.data?.verified_on ?? null}
      templates={(templates.data as Template[] | null) ?? []}
      drivers={(drivers.data as { id: string; name: string }[] | null) ?? []}
    />
  );
}
