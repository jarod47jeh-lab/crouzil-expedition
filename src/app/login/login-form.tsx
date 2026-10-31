"use client";
import { useActionState, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, MailCheck } from "lucide-react";
import { signIn, sendPasswordReset } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Logo } from "@/components/app/logo";

export function LoginForm({ next, error }: { next: string; error?: string }) {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [state, action, pending] = useActionState(signIn, error ? { error: "Le lien a expiré ou n'est plus valide. Connectez-vous ou demandez un nouveau lien." } : {});
  const [rstate, raction, rpending] = useActionState(sendPasswordReset, {});

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-brand/15 blur-3xl"
        animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -left-40 h-[460px] w-[460px] rounded-full bg-info/10 blur-3xl"
        animate={{ scale: [1.05, 1, 1.05] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[420px] rounded-3xl border border-line bg-surface/90 p-8 shadow-pop backdrop-blur"
      >
        <div className="mb-7 flex items-center gap-3">
          <Logo className="h-12 w-12" />
          <div>
            <h1 className="text-2xl font-bold leading-tight">Espace Expédition</h1>
            <p className="text-sm text-muted">Crouzil Boissons</p>
          </div>
        </div>
        <AnimatePresence mode="wait">
          {mode === "login" ? (
            <motion.form key="login" action={action} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="grid gap-4">
              <input type="hidden" name="next" value={next} />
              <Field label="E-mail">
                <Input key={state?.email} name="email" type="email" autoComplete="email" required defaultValue={state?.email} autoFocus={!state?.email} />
              </Field>
              <Field label="Mot de passe">
                <Input name="password" type="password" autoComplete="current-password" required autoFocus={!!state?.email} />
              </Field>
              {state?.error && <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}
              <Button type="submit" loading={pending} className="mt-1 h-11 justify-center">
                Se connecter <ArrowRight className="h-4 w-4" />
              </Button>
              <button type="button" onClick={() => setMode("reset")} className="text-sm text-muted hover:text-ink">
                Mot de passe oublié ?
              </button>
            </motion.form>
          ) : (
            <motion.form key="reset" action={raction} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="grid gap-4">
              {rstate?.sent ? (
                <div className="flex items-start gap-3 rounded-2xl bg-ok/10 p-4 text-sm text-ok">
                  <MailCheck className="h-5 w-5 shrink-0" />
                  Si un compte existe pour cette adresse, un e-mail vient d&apos;être envoyé avec un lien pour choisir un nouveau mot de passe.
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted">Recevez un lien par e-mail pour choisir un nouveau mot de passe.</p>
                  <Field label="E-mail">
                    <Input name="email" type="email" required autoFocus />
                  </Field>
                  {rstate?.error && <p className="text-sm text-bad">{rstate.error}</p>}
                  <Button type="submit" loading={rpending} className="h-11 justify-center">
                    Envoyer le lien
                  </Button>
                </>
              )}
              <button type="button" onClick={() => setMode("login")} className="text-sm text-muted hover:text-ink">
                Retour à la connexion
              </button>
            </motion.form>
          )}
        </AnimatePresence>
        <p className="mt-6 border-t border-line pt-4 text-center text-xs text-muted">Accès sur invitation, réservé aux responsables et à la direction.</p>
      </motion.div>
    </div>
  );
}
