"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveRow } from "@/lib/actions/crud";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Field, Input, Select, Switch, Textarea } from "./form";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "textarea" | "checkbox" | "email" | "tel";
  options?: (string | [string, string])[];
  required?: boolean;
  full?: boolean;
  hint?: string;
  placeholder?: string;
  step?: string;
  /** Afficher le champ seulement si la condition est vraie */
  when?: (v: Record<string, unknown>) => boolean;
}

export function EntityForm({
  open,
  onClose,
  title,
  table,
  id,
  initial,
  fields,
  onSaved,
  transform,
  validate,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  table: string;
  id?: string | null;
  initial: Record<string, unknown>;
  fields: FieldDef[];
  onSaved?: (id: string) => void;
  transform?: (v: Record<string, unknown>) => Record<string, unknown>;
  validate?: (v: Record<string, unknown>) => string | null;
  extra?: (v: Record<string, unknown>) => React.ReactNode;
}) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, unknown>>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) {
      setV(initial);
      setErr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: string, val: unknown) => setV((o) => ({ ...o, [k]: val }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of fields) {
      if (f.required && (!f.when || f.when(v)) && (v[f.name] == null || String(v[f.name]).trim() === "")) {
        setErr(`« ${f.label} » est obligatoire.`);
        return;
      }
    }
    const msg = validate?.(v);
    if (msg) return setErr(msg);
    start(async () => {
      const payload = transform ? transform(v) : v;
      const res = await saveRow(table, id || null, payload);
      if (!res.ok) return setErr(res.error);
      toast.success(id ? "Modifications enregistrées" : "Ajouté");
      onClose();
      onSaved?.(res.data!.id);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="entity-form" loading={pending}>
            {id ? "Enregistrer" : "Ajouter"}
          </Button>
        </>
      }
    >
      <form id="entity-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {fields
          .filter((f) => !f.when || f.when(v))
          .map((f) => {
            const val = v[f.name];
            const common = { id: `f-${f.name}`, name: f.name, placeholder: f.placeholder };
            if (f.type === "checkbox")
              return (
                <div key={f.name} className={f.full ? "sm:col-span-2" : ""}>
                  <Switch checked={!!val} onChange={(c) => set(f.name, c)} label={f.label} />
                </div>
              );
            return (
              <Field key={f.name} label={f.label + (f.required ? " *" : "")} hint={f.hint} full={f.full || f.type === "textarea"}>
                {f.type === "select" ? (
                  <Select {...common} value={String(val ?? "")} onChange={(e) => set(f.name, e.target.value)} options={f.options || []} placeholder={f.required ? undefined : "—"} />
                ) : f.type === "textarea" ? (
                  <Textarea {...common} value={String(val ?? "")} onChange={(e) => set(f.name, e.target.value)} rows={3} />
                ) : (
                  <Input
                    {...common}
                    type={f.type || "text"}
                    step={f.step}
                    value={val == null ? "" : String(val)}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                )}
              </Field>
            );
          })}
        {extra && <div className="sm:col-span-2">{extra(v)}</div>}
        {err && <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad sm:col-span-2">{err}</p>}
      </form>
    </Dialog>
  );
}

/** Petit hook pour piloter un formulaire « nouveau / modifier » depuis une page */
export function useEditor<T extends { id: string }>() {
  const [state, setState] = useState<{ open: boolean; row: T | null }>({ open: false, row: null });
  return {
    open: state.open,
    row: state.row,
    create: () => setState({ open: true, row: null }),
    edit: (row: T) => setState({ open: true, row }),
    close: () => setState((s) => ({ ...s, open: false })),
  };
}
