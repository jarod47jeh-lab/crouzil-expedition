"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { deleteJustification, saveJustification } from "@/lib/actions/crud";
import { JUSTIF_CONCLUSIONS, JUSTIF_QUESTIONS } from "@/lib/domain/constants";
import { fmtDate, iso } from "@/lib/domain/dates";
import type { DeliveryError, Justification } from "@/lib/types";

export function JustificationDialog({ error, justif, onClose }: { error: DeliveryError | null; justif: Justification | null; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  useEffect(() => {
    if (error) {
      const base: Record<string, string> = { collected_on: iso(new Date()), conclusion: "" };
      if (justif) for (const [k, val] of Object.entries(justif)) if (val != null) base[k] = String(val);
      setV(base);
    }
  }, [error, justif]);
  if (!error) return <Dialog open={false} onClose={onClose} title="">{null}</Dialog>;
  const set = (k: string, val: string) => setV((o) => ({ ...o, [k]: val }));
  const save = () =>
    start(async () => {
      const res = await saveJustification(error.id, v);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Justification enregistrée");
      onClose();
      router.refresh();
    });
  const remove = () =>
    start(async () => {
      const res = await deleteJustification(error.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Justification effacée");
      onClose();
      router.refresh();
    });
  return (
    <Dialog
      open={!!error}
      onClose={onClose}
      wide
      title="Justification de l'employé"
      subtitle={`${fmtDate(error.date)} · ${error.client_name} · ${error.error_type} · Concerné : ${[error.picker, error.driver, error.other_resp].filter(Boolean).join(", ") || "non indiqué"}`}
      footer={
        <>
          {justif && (
            <Button variant="danger" className="mr-auto" onClick={remove} disabled={pending}>
              Effacer
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} loading={pending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <p className="mb-4 rounded-xl bg-info/10 px-3 py-2 text-sm text-info">À remplir avec l&apos;employé, en recueillant sa version avant toute décision.</p>
      <div className="grid gap-3">
        {JUSTIF_QUESTIONS.map(([k, q]) => (
          <div key={k} className="grid items-center gap-2 sm:grid-cols-[1fr_150px]">
            <span className="text-sm">{q}</span>
            <Select value={v[k] || ""} onChange={(e) => set(k, e.target.value)} options={[["oui", "Oui"], ["non", "Non"]]} placeholder="Non précisé" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Explication de l'employé, avec ses mots" full>
          <Textarea rows={3} value={v.employee_account || ""} onChange={(e) => set("employee_account", e.target.value)} />
        </Field>
        <Field label="Éléments de preuve ou témoins" full>
          <Textarea rows={2} value={v.evidence || ""} onChange={(e) => set("evidence", e.target.value)} />
        </Field>
        <Field label="Observations du responsable" full>
          <Textarea rows={2} value={v.manager_notes || ""} onChange={(e) => set("manager_notes", e.target.value)} />
        </Field>
        <Field label="Appréciation">
          <Select value={v.conclusion || ""} onChange={(e) => set("conclusion", e.target.value)} options={Object.entries(JUSTIF_CONCLUSIONS).map(([k, c]) => [k, c.label])} />
        </Field>
        <Field label="Date de recueil">
          <Input type="date" value={v.collected_on || ""} onChange={(e) => set("collected_on", e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
