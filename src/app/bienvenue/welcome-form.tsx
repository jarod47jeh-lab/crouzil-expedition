"use client";
import { useActionState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Quote } from "lucide-react";
import { completeOnboarding } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Logo } from "@/components/app/logo";

export function WelcomeForm({ email, name, invitedBy, message, reset }: { email: string; name: string; invitedBy: string; message: string; reset: boolean }) {
  const [state, action, pending] = useActionState(completeOnboarding, {});
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-brand/15 blur-3xl"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[460px] rounded-3xl border border-line bg-surface/95 p-8 shadow-pop backdrop-blur"
      >
        <div className="mb-6 flex items-center gap-3">
          <Logo className="h-12 w-12" />
          <div>
            <h1 className="text-2xl leading-tight font-bold">{reset ? "Nouveau mot de passe" : "Bienvenue !"}</h1>
            <p className="text-sm text-muted">Espace Expédition · Crouzil Boissons</p>
          </div>
        </div>
        {!reset && (
          <p className="mb-4 text-[15px]">
            {invitedBy ? (
              <>
                <b>{invitedBy}</b> vous a invité à rejoindre l&apos;Espace Expédition.
              </>
            ) : (
              <>Vous avez été invité à rejoindre l&apos;Espace Expédition.</>
            )}{" "}
            Dernière étape : choisissez votre mot de passe pour vos prochaines connexions.
          </p>
        )}
        {message && (
          <div className="mb-5 flex gap-2 rounded-2xl bg-surface-2 p-4 text-sm">
            <Quote className="h-4 w-4 shrink-0 text-brand" />
            <p className="whitespace-pre-wrap">{message}</p>
          </div>
        )}
        <form action={action} className="grid gap-4">
          <Field label="E-mail de connexion">
            <Input value={email} readOnly disabled />
          </Field>
          <Field label="Nom et prénom">
            <Input name="full_name" defaultValue={name} required autoComplete="name" />
          </Field>
          <Field label="Mot de passe" hint="8 caractères minimum">
            <Input name="password" type="password" required minLength={8} autoComplete="new-password" autoFocus />
          </Field>
          <Field label="Confirmer le mot de passe">
            <Input name="password2" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          {state?.error && <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}
          <Button type="submit" loading={pending} className="mt-1 h-11 justify-center">
            {reset ? "Enregistrer" : "Entrer dans l'Espace Expédition"} <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
