"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./crud";

const site = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function signIn(
  _: unknown,
  form: FormData,
): Promise<{ error?: string; email?: string }> {
  const supabase = await createClient();
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "E-mail ou mot de passe incorrect.", email };
  const next = String(form.get("next") || "/");
  redirect(next.startsWith("/") ? next : "/");
}

export async function sendPasswordReset(
  _: unknown,
  form: FormData,
): Promise<{ error?: string; sent?: boolean }> {
  const email = String(form.get("email") || "").trim();
  if (!email) return { error: "Indiquez votre e-mail." };
  // flux « implicit » : le lien fonctionne même s'il est ouvert sur un autre appareil
  const anon = createJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, flowType: "implicit" },
    },
  );
  await anon.auth.resetPasswordForEmail(email, {
    redirectTo: `${site()}/auth/callback?next=${encodeURIComponent("/bienvenue?reset=1")}`,
  });
  return { sent: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateAccount(values: {
  full_name?: string;
  password?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée, reconnectez-vous." };
  if (values.password) {
    if (values.password.length < 8)
      return {
        ok: false,
        error: "Le mot de passe doit faire au moins 8 caractères.",
      };
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });
    if (error) return { ok: false, error: error.message };
    await supabase
      .from("members")
      .update({ password_set: true })
      .eq("id", user.id);
  }
  if (values.full_name != null) {
    const { error } = await supabase
      .from("members")
      .update({ full_name: values.full_name.trim() || null })
      .eq("id", user.id);
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
  const { data } = await supabase
    .from("members")
    .select("id,active,full_name,email,role")
    .eq("id", user.id)
    .maybeSingle();
  // la gestion des comptes est réservée aux administrateurs
  return data?.active && data.role === "admin"
    ? {
        id: user.id,
        name:
          (data.full_name as string) || (data.email as string).split("@")[0],
      }
    : null;
}

const ROLE_KEYS = ["admin", "editor", "contributor", "reader"];
const MODULE_KEYS = [
  "conges",
  "reparations",
  "erreurs",
  "remontees",
  "journal",
  "taches",
  "equipe",
  "parc",
  "clients",
];
function cleanAccess(role: string, modules: string[] | null) {
  const r = ROLE_KEYS.includes(role) ? role : "reader";
  const m =
    modules == null ? null : modules.filter((x) => MODULE_KEYS.includes(x));
  return { role: r, modules: r === "admin" ? null : m };
}

/** Rôle et menus d'un compte (administrateurs uniquement) */
export async function setMemberAccess(
  id: string,
  role: string,
  modules: string[] | null,
): Promise<ActionResult> {
  const me = await requireMember();
  if (!me) return { ok: false, error: "Réservé aux administrateurs." };
  if (me.id === id && role !== "admin")
    return {
      ok: false,
      error: "Vous ne pouvez pas retirer votre propre rôle d'administrateur.",
    };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .update(cleanAccess(role, modules))
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Modification refusée." };
  revalidatePath("/utilisateurs");
  return { ok: true };
}

const callbackUrl = (reset = false) =>
  `${site()}/auth/callback?next=${encodeURIComponent(reset ? "/bienvenue?reset=1" : "/bienvenue")}`;

export async function inviteMember(
  email: string,
  fullName: string,
  message = "",
  role = "reader",
  modules: string[] | null = null,
): Promise<ActionResult> {
  const me = await requireMember();
  if (!me) return { ok: false, error: "Réservé aux administrateurs." };
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean))
    return { ok: false, error: "Adresse e-mail invalide." };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(clean, {
    data: {
      full_name: fullName.trim() || undefined,
      invited_by: me.name,
      message: message.trim().slice(0, 600) || undefined,
    },
    redirectTo: callbackUrl(),
  });
  if (error) {
    if (/already/i.test(error.message))
      return {
        ok: false,
        error:
          "Cette personne a déjà un compte. Utilisez « Renvoyer » dans la liste.",
      };
    if (/rate limit/i.test(error.message))
      return {
        ok: false,
        error:
          "Trop d'e-mails envoyés en peu de temps. Utilisez « Copier le lien » ou réessayez dans une heure.",
      };
    return { ok: false, error: error.message };
  }
  // rôle et menus choisis dans l'écran d'invitation
  await admin
    .from("members")
    .update(cleanAccess(role, modules))
    .eq("email", clean);
  revalidatePath("/utilisateurs");
  return { ok: true };
}

async function targetUser(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data.user?.email) throw new Error("Compte introuvable.");
  return { admin, user: data.user, email: data.user.email };
}

/** Renvoie un e-mail : invitation si le compte n'est pas encore activé, sinon lien pour (re)choisir le mot de passe. */
export async function resendInvite(
  id: string,
): Promise<ActionResult<{ kind: "invite" | "recovery" }>> {
  const me = await requireMember();
  if (!me) return { ok: false, error: "Réservé aux administrateurs." };
  try {
    const { admin, user, email } = await targetUser(id);
    if (!user.email_confirmed_at) {
      await admin.auth.admin.updateUserById(id, {
        user_metadata: { ...user.user_metadata, invited_by: me.name },
      });
      const { error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { ...user.user_metadata, invited_by: me.name },
        redirectTo: callbackUrl(),
      });
      if (error) throw error;
      return { ok: true, data: { kind: "invite" } };
    }
    await admin.auth.admin.updateUserById(id, {
      user_metadata: { ...user.user_metadata, invited_by: me.name },
    });
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl(true),
    });
    if (error) throw error;
    return { ok: true, data: { kind: "recovery" } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/rate limit/i.test(msg))
      return {
        ok: false,
        error:
          "Trop d'e-mails envoyés en peu de temps. Utilisez « Copier le lien » à la place.",
      };
    return { ok: false, error: msg };
  }
}

/** Crée un lien d'activation à transmettre soi-même (SMS, WhatsApp…). Aucun e-mail n'est envoyé. */
export async function inviteLink(
  id: string,
): Promise<ActionResult<{ url: string }>> {
  const me = await requireMember();
  if (!me) return { ok: false, error: "Réservé aux administrateurs." };
  try {
    const { admin, user, email } = await targetUser(id);
    const type = user.email_confirmed_at ? "recovery" : "invite";
    const { data, error } = await admin.auth.admin.generateLink({
      type,
      email,
      options: { redirectTo: callbackUrl(type === "recovery") },
    });
    if (error) throw error;
    const token = data.properties?.hashed_token;
    if (!token) throw new Error("Lien indisponible.");
    return {
      ok: true,
      data: {
        url: `${site()}/auth/accepter?token_hash=${encodeURIComponent(token)}&type=${type}`,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Page « Activer mon accès » : le lien n'est consommé qu'au clic sur le bouton (les antivirus de messagerie ne le grillent plus). */
export async function acceptLink(
  _: unknown,
  form: FormData,
): Promise<{ error?: string }> {
  const token_hash = String(form.get("token_hash") || "");
  const type = String(form.get("type") || "invite") as
    | "invite"
    | "recovery"
    | "magiclink";
  if (!token_hash) return { error: "Lien incomplet." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error || !data.user)
    return {
      error:
        "Ce lien a expiré ou a déjà été utilisé. Demandez à la personne qui vous a invité de vous en renvoyer un.",
    };
  redirect(type === "recovery" ? "/bienvenue?reset=1" : "/bienvenue");
}

/** Première connexion : nom + mot de passe obligatoires avant d'entrer dans l'appli. */
export async function completeOnboarding(
  _: unknown,
  form: FormData,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée : rouvrez le lien reçu." };
  const name = String(form.get("full_name") || "").trim();
  const pw = String(form.get("password") || "");
  const pw2 = String(form.get("password2") || "");
  if (!name) return { error: "Indiquez votre nom." };
  if (pw.length < 8)
    return { error: "Le mot de passe doit faire au moins 8 caractères." };
  if (pw !== pw2)
    return { error: "Les deux mots de passe ne sont pas identiques." };
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error && !/same|different from the old/i.test(error.message))
    return { error: error.message };
  const { error: e2 } = await supabase
    .from("members")
    .update({ full_name: name, password_set: true })
    .eq("id", user.id);
  if (e2) return { error: e2.message };
  revalidatePath("/", "layout");
  redirect("/");
}

export async function setMemberActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const me = await requireMember();
  if (!me) return { ok: false, error: "Réservé aux administrateurs." };
  if (me.id === id && !active)
    return {
      ok: false,
      error: "Vous ne pouvez pas désactiver votre propre compte.",
    };
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({ active })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/utilisateurs");
  return { ok: true };
}
