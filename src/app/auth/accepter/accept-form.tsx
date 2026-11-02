"use client";
import { useActionState } from "react";
import { motion } from "motion/react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { acceptLink } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/logo";

export function AcceptForm({ tokenHash, type }: { tokenHash: string; type: "invite" | "recovery" }) {
  const [state, action, pending] = useActionState(acceptLink, {});
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[420px] rounded-3xl border border-line bg-surface p-8 text-center shadow-pop"
      >
        <Logo className="mx-auto h-14 w-14" />
        <h1 className="mt-4 text-2xl font-bold">{type === "recovery" ? "Nouveau mot de passe" : "Bienvenue dans l'Espace Expédition"}</h1>
        <p className="mt-2 text-sm text-muted">
          {type === "recovery"
            ? "Cliquez sur le bouton pour choisir un nouveau mot de passe."
            : "Vous avez été invité à rejoindre l'outil du service expédition de Crouzil Boissons. Cliquez sur le bouton pour activer votre accès."}
        </p>
        {tokenHash ? (
          <form action={action} className="mt-6 grid gap-3">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <Button type="submit" loading={pending} className="h-12 justify-center text-[15px]">
              {type === "recovery" ? "Continuer" : "Activer mon accès"} <ArrowRight className="h-4 w-4" />
            </Button>
            {state?.error && <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}
          </form>
        ) : (
          <p className="mt-6 rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">Ce lien est incomplet. Rouvrez-le depuis l&apos;e-mail ou le message reçu.</p>
        )}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5" /> Accès réservé aux responsables et à la direction.
        </p>
      </motion.div>
    </div>
  );
}
