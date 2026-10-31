"use client";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { saveSettings } from "@/lib/actions/crud";
import type { Settings } from "@/lib/types";

export function SettingsView({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(settings).map(([k, x]) => [k, x == null ? "" : String(x)])));
  const [pending, start] = useTransition();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV((o) => ({ ...o, [k]: e.target.value }));
  const save = () =>
    start(async () => {
      const res = await saveSettings(v);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Réglages enregistrés");
      router.refresh();
    });
  return (
    <>
      <PageHeader
        title="Réglages"
        icon={<Settings2 className="h-6 w-6" />}
        subtitle="Seuils d'alerte et paramètres des modules"
        actions={<Button onClick={save} loading={pending}>Enregistrer</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Présences et congés" subtitle="Alerte quand trop de personnes sont absentes le même jour" />
          <div className="grid gap-4 px-5 pb-5">
            <Field label="Chauffeurs : absents simultanés maximum">
              <Input type="number" min={1} max={20} value={v.max_abs} onChange={set("max_abs")} />
            </Field>
            <Field label="Préparateurs : absents simultanés maximum">
              <Input type="number" min={1} max={20} value={v.max_abs_prep} onChange={set("max_abs_prep")} />
            </Field>
            <p className="text-xs text-muted">Les jours fériés français sont calculés automatiquement. Les soldes ne comptent que les demandes validées.</p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Réparations" subtitle="Destinataire des demandes à transmettre" />
          <div className="grid gap-4 px-5 pb-5">
            <Field label="Prénom du destinataire">
              <Input value={v.repair_contact_name} onChange={set("repair_contact_name")} />
            </Field>
            <Field label="E-mail du destinataire">
              <Input type="email" value={v.repair_contact_email} onChange={set("repair_contact_email")} />
            </Field>
            <Field label="Signature des messages">
              <Input value={v.signature} onChange={set("signature")} />
            </Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Erreurs de livraison" />
          <div className="grid gap-4 px-5 pb-5">
            <Field label="Objectif de conformité (%)" hint="En dessous, les indicateurs passent au rouge.">
              <Input type="number" step="0.1" min={50} max={100} value={v.conformity_target} onChange={set("conformity_target")} />
            </Field>
          </div>
        </Card>
      </div>
    </>
  );
}
