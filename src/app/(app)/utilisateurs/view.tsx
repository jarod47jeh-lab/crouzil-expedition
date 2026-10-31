"use client";
import { useRouter } from "next/navigation";
import { MailPlus, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { inviteMember, setMemberActive } from "@/lib/actions/auth";
import { fmtDateTime } from "@/lib/domain/dates";
import type { Member } from "@/lib/types";

export function UsersView({ members, me, canInvite }: { members: Member[]; me: string; canInvite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const invite = () =>
    start(async () => {
      const res = await inviteMember(email, name);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Invitation envoyée à ${email}`);
      setOpen(false);
      setEmail("");
      setName("");
      router.refresh();
    });
  const toggle = (m: Member) =>
    start(async () => {
      const res = await setMemberActive(m.id, !m.active);
      if (!res.ok) return void toast.error(res.error);
      toast.success(m.active ? "Accès retiré" : "Accès rétabli");
      router.refresh();
    });
  return (
    <>
      <PageHeader
        title="Utilisateurs"
        icon={<ShieldCheck className="h-6 w-6" />}
        subtitle="Responsables et direction : tous les comptes ont les mêmes droits"
        actions={
          <Button onClick={() => setOpen(true)} disabled={!canInvite} title={canInvite ? "" : "Clé SUPABASE_SERVICE_ROLE_KEY manquante sur le serveur"}>
            <MailPlus className="h-4 w-4" /> Inviter
          </Button>
        }
      />
      <DataTable
        rows={members}
        searchText={(m) => `${m.full_name} ${m.email}`}
        initialSort={{ key: "name", dir: "asc" }}
        columns={[
          { key: "name", header: "Nom", sort: (m) => m.full_name || m.email, cell: (m) => <b>{m.full_name || "–"}{m.id === me && <span className="ml-2 text-xs font-normal text-muted">(vous)</span>}</b> },
          { key: "email", header: "E-mail", sort: (m) => m.email, cell: (m) => m.email },
          { key: "seen", header: "Dernière visite", hideOnMobile: true, sort: (m) => m.last_seen_at || "", cell: (m) => <span className="text-muted">{m.last_seen_at ? fmtDateTime(m.last_seen_at) : "jamais connecté"}</span> },
          { key: "st", header: "Accès", sort: (m) => Number(m.active), cell: (m) => <Badge tone={m.active ? "ok" : "muted"} dot>{m.active ? "Actif" : "Désactivé"}</Badge> },
          {
            key: "act",
            header: "",
            cell: (m) =>
              m.id !== me && (
                <Button size="sm" variant={m.active ? "danger" : "secondary"} onClick={() => toggle(m)} disabled={pending}>
                  {m.active ? "Retirer l'accès" : "Rétablir"}
                </Button>
              ),
          },
        ]}
      />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Inviter une personne"
        subtitle="Elle recevra un e-mail pour choisir son mot de passe."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={invite} loading={pending} disabled={!email}>
              Envoyer l&apos;invitation
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="E-mail *">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <Field label="Nom et prénom">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
