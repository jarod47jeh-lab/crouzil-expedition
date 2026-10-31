"use client";
import { useRouter } from "next/navigation";
import { KeyRound, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { updateAccount } from "@/lib/actions/auth";

export function AccountView({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [n, setN] = useState(name);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pending, start] = useTransition();
  const save = (what: "name" | "pw") =>
    start(async () => {
      if (what === "pw" && pw !== pw2) return void toast.error("Les deux mots de passe ne sont pas identiques.");
      const res = await updateAccount(what === "name" ? { full_name: n } : { password: pw });
      if (!res.ok) return void toast.error(res.error);
      toast.success(what === "name" ? "Nom enregistré" : "Mot de passe modifié");
      setPw("");
      setPw2("");
      router.refresh();
    });
  return (
    <>
      <PageHeader title="Mon compte" icon={<UserRound className="h-6 w-6" />} subtitle={email} />
      {!name && (
        <p className="mb-6 rounded-2xl border border-info/30 bg-info/10 p-4 text-sm text-info">
          Bienvenue ! Indiquez votre nom et choisissez un mot de passe pour vos prochaines connexions.
        </p>
      )}
      <div className="grid max-w-3xl gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Profil" />
          <div className="grid gap-4 px-5 pb-5">
            <Field label="Nom et prénom">
              <Input value={n} onChange={(e) => setN(e.target.value)} />
            </Field>
            <Button onClick={() => save("name")} loading={pending} className="justify-self-start">
              Enregistrer
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Mot de passe" />
          <div className="grid gap-4 px-5 pb-5">
            <Field label="Nouveau mot de passe" hint="8 caractères minimum">
              <Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
            <Field label="Confirmer">
              <Input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </Field>
            <Button onClick={() => save("pw")} loading={pending} disabled={!pw} className="justify-self-start">
              <KeyRound className="h-4 w-4" /> Changer le mot de passe
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
