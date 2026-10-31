import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Client « service_role » : contourne la sécurité. À n'utiliser que côté serveur, après contrôle. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
