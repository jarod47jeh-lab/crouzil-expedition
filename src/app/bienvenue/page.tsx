import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WelcomeForm } from "./welcome-form";

export const metadata = { title: "Bienvenue" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=link");
  const { data: m } = await supabase.from("members").select("full_name,email,active,password_set,invited_by").eq("id", user.id).maybeSingle();
  if (!m?.active) redirect("/");
  const reset = sp.reset === "1";
  if (m.password_set && !reset) redirect("/");
  const invitedBy = (user.user_metadata?.invited_by as string) || m.invited_by || "";
  const message = (user.user_metadata?.message as string) || "";
  return <WelcomeForm email={m.email} name={m.full_name || ""} invitedBy={invitedBy} message={reset ? "" : message} reset={reset && m.password_set} />;
}
