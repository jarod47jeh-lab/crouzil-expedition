import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/app/shell";
import { signOut } from "@/lib/actions/auth";
import { PermsProvider } from "@/components/app/perms-context";
import type { ModuleKey, Role } from "@/lib/perms";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase.from("members").select("full_name,email,active,password_set,role,modules").eq("id", user.id).maybeSingle();
  if (!member?.active) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-xl font-bold">Accès non autorisé</h1>
          <p className="mt-2 text-sm text-muted">Votre compte ({user.email}) n&apos;est pas ou plus autorisé. Demandez à un responsable de vous réactiver.</p>
          <form action={signOut} className="mt-4">
            <button className="text-brand underline">Se déconnecter</button>
          </form>
        </div>
      </div>
    );
  }

  if (!member.password_set) redirect("/bienvenue");

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const [leaves, repairs, notes, tasks] = await Promise.all([
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null),
    supabase.from("repairs").select("id", { count: "exact", head: true }).eq("status", "A").is("deleted_at", null),
    supabase.from("delivery_notes").select("id", { count: "exact", head: true }).eq("status", "todo").is("deleted_at", null),
    // tâches en retard ou pour aujourd'hui
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("done", false).lte("due_date", today).is("deleted_at", null),
  ]);
  void supabase.from("members").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id).then(() => {});

  return (
    <PermsProvider value={{ role: (member.role as Role) || "reader", modules: (member.modules as ModuleKey[] | null) ?? null }}>
      <Shell user={{ name: member.full_name || member.email, email: member.email }} badges={{ leaves: leaves.count || 0, repairs: repairs.count || 0, notes: notes.count || 0, tasks: tasks.count || 0 }}>
        {children}
      </Shell>
    </PermsProvider>
  );
}
