"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Retour des liens d'invitation et de réinitialisation (jeton dans l'URL). */
export default function AuthCallback() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const next = url.searchParams.get("next") || "/bienvenue";
      const hash = new URLSearchParams(url.hash.slice(1));
      const code = url.searchParams.get("code");
      let ok = false;
      if (hash.get("access_token") && hash.get("refresh_token")) {
        const { error } = await supabase.auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! });
        ok = !error;
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        ok = !error;
      } else {
        const { data } = await supabase.auth.getSession();
        ok = !!data.session;
      }
      if (ok) window.location.replace(next.startsWith("/") ? next : "/");
      else setFailed(true);
    };
    run();
  }, []);
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      {failed ? (
        <div>
          <p className="font-semibold">Ce lien a expiré ou a déjà été utilisé.</p>
          <p className="mt-1 text-sm text-muted">Demandez à la personne qui vous a invité de vous renvoyer une invitation depuis l&apos;Espace Expédition.</p>
          <a href="/login" className="mt-3 inline-block text-brand underline">
            Revenir à la connexion
          </a>
        </div>
      ) : (
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      )}
    </div>
  );
}
