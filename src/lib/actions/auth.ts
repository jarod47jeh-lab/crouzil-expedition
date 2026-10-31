"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./crud";

const site = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function signIn(_: unknown, form: FormData): Promise<{ error?: string; email?: string }> {
  const supabase = await createClient();
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "E-mail ou mot de passe incorrect.", email };
  const next = String(form.get("next") || "/");
  redirect(next.startsWith("/") ? next : "/");
}

export async function sendPasswordReset(_: unknown, form: FormData): Promise<{ error?: string; sent?: boolean }> {
  const supabase = await createClient();
  const email = String(form.get("email") || "").trim();
  if (!email) return { error: "Indiquez votre e-mail." };
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site()}/auth/callback?next=/compte` });
  return { sent: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateAccount(values: { full_name?: string; password?: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée, reconnectez-vous." };
  if (values.password) {
    if (values.password.length < 8) return { ok: false, error: "Le mot de passe doit faire au moins 8 caractères." };
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) return { ok: false, error: error.message };
  }
  if (values.full_name != null) {
    const { error } = await supabase.from("members").update({ full_name: values.full_name.trim() || null }).eq("id", user.id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

async function requireMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("members").select("id,active").eq("id", user.id).maybeSingle();
  return data?.active ? user : null;
}

export async function inviteMember(email: string, fullName: string): Promise<ActionResult> {
  const me = await requireMember();
  if (!me) return { ok: false, error: "Accès refusé." };
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { ok: false, error: "Adresse e-mail invalide." };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(clean, {
    data: { full_name: fullName.trim() || undefined },
    redirectTo: `${site()}/auth/callback?next=/compte`,
  });
  if (error) {
    if (/already/i.test(error.message)) return { ok: false, error: "Cette personne a déjà un compte." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/utilisateurs");
  return { ok: true };
}

export async function setMemberActive(id: string, active: boolean): Promise<ActionResult> {
  const me = await requireMember();
  if (!me) return { ok: false, error: "Accès refusé." };
  if (me.id === id && !active) return { ok: false, error: "Vous ne pouvez pas désactiver votre propre compte." };
  const supabase = await createClient();
  const { error } = await supabase.from("members").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/utilisateurs");
  return { ok: true };
}
