"use client";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { usePerms } from "@/components/app/perms-context";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { deleteWorktimeTemplate, saveWorktimeTemplate } from "@/lib/actions/worktime";

export interface Template {
  id: string;
  name: string;
  kind: "controle" | "simulation";
  data: Record<string, unknown>;
}

/** Modèles enregistrés : tout le monde peut en charger un, seul l'administrateur en crée ou en supprime. */
export function TemplateBar<T extends object>({ kind, templates, current, onLoad }: { kind: Template["kind"]; templates: Template[]; current: T; onLoad: (data: T) => void }) {
  const admin = usePerms().admin;
  const router = useRouter();
  const list = templates.filter((t) => t.kind === kind);
  const [sel, setSel] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  if (!list.length && !admin) return null;

  const save = () =>
    start(async () => {
      const r = await saveWorktimeTemplate(name, kind, current as Record<string, unknown>);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Modèle enregistré");
      setOpen(false);
      setName("");
      router.refresh();
    });
  const remove = () => {
    const t = list.find((x) => x.id === sel);
    if (!t || !confirm(`Supprimer le modèle « ${t.name} » ?`)) return;
    start(async () => {
      const r = await deleteWorktimeTemplate(t.id);
      if (!r.ok) return void toast.error(r.error);
      setSel("");
      toast.success("Modèle supprimé");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      {list.length > 0 && (
        <label className="flex min-w-[200px] flex-1 flex-col gap-1.5 sm:flex-none">
          <span className="text-[13px] font-medium text-ink/85">Modèle enregistré</span>
          <select
            className="field pr-8"
            value={sel}
            onChange={(e) => {
              setSel(e.target.value);
              const t = list.find((x) => x.id === e.target.value);
              if (t) onLoad({ ...current, ...(t.data as Partial<T>) });
            }}
          >
            <option value="">Choisir un modèle</option>
            {list.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {admin && (
        <>
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Save className="h-4 w-4" /> Enregistrer comme modèle
          </Button>
          {sel && (
            <Button variant="ghost" onClick={remove} disabled={pending} aria-label="Supprimer le modèle choisi">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Enregistrer comme modèle" subtitle="Les autres utilisateurs pourront le charger, sans pouvoir le modifier">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Nom du modèle">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "simulation" ? "Tournée Toulouse centre" : "Journée type 5h00"} autoFocus required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
