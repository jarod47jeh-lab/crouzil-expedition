"use client";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, MailPlus, Send, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { inviteLink, inviteMember, resendInvite, setMemberActive } from "@/lib/actions/auth";
import { fmtDateTime } from "@/lib/domain/dates";
import type { Member } from "@/lib/types";

export function UsersView({ members, me, myName, canInvite }: { members: Member[]; me: string; myName: string; canInvite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState<{ who: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const invite = () =>
    start(async () => {
      const res = await inviteMember(email, name, message);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Invitation envoyée à ${email}`);
      setOpen(false);
      setEmail("");
      setName("");
      setMessage("");
      router.refresh();
    });
  const resend = (m: Member) =>
    start(async () => {
      const res = await resendInvite(m.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data?.kind === "invite" ? `Nouvelle invitation envoyée à ${m.email}` : `E-mail envoyé à ${m.email} pour choisir son mot de passe`);
    });
  const makeLink = (m: Member) =>
    start(async () => {
      const res = await inviteLink(m.id);
      if (!res.ok) return void toast.error(res.error);
      setCopied(false);
      setLink({ who: m.full_name || m.email, url: res.data!.url });
    });
  const copy = async () => {
    if (!link) return;
    const text = `Bonjour, ${myName} vous invite sur l'Espace Expédition (Crouzil Boissons). Activez votre accès ici (lien valable 24 h) : ${link.url}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Message copié, prêt à coller dans un SMS ou WhatsApp");
    } catch {
      toast.error("Copie impossible : sélectionnez le lien à la main.");
    }
  };
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
          {
            key: "name",
            header: "Nom",
            sort: (m) => m.full_name || m.email,
            cell: (m) => (
              <b>
                {m.full_name || "–"}
                {m.id === me && <span className="ml-2 text-xs font-normal text-muted">(vous)</span>}
              </b>
            ),
          },
          { key: "email", header: "E-mail", sort: (m) => m.email, cell: (m) => m.email },
          {
            key: "seen",
            header: "Dernière visite",
            hideOnMobile: true,
            sort: (m) => m.last_seen_at || "",
            cell: (m) => <span className="text-muted">{m.last_seen_at ? fmtDateTime(m.last_seen_at) : "jamais connecté"}</span>,
          },
          {
            key: "st",
            header: "Accès",
            sort: (m) => (m.active ? (m.password_set ? 2 : 1) : 0),
            cell: (m) =>
              !m.active ? (
                <Badge tone="muted" dot>Désactivé</Badge>
              ) : m.password_set ? (
                <Badge tone="ok" dot>Actif</Badge>
              ) : (
                <Badge tone="warn" dot>Invitation en attente</Badge>
              ),
          },
          {
            key: "act",
            header: "",
            cell: (m) =>
              m.id !== me && (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {m.active && !m.password_set && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => resend(m)} disabled={pending || !canInvite} title="Renvoyer l'e-mail d'invitation">
                        <Send className="h-3.5 w-3.5" /> Renvoyer
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => makeLink(m)} disabled={pending || !canInvite} title="Obtenir un lien à envoyer par SMS ou WhatsApp">
                        <Link2 className="h-3.5 w-3.5" /> Copier le lien
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant={m.active ? "danger" : "secondary"} onClick={() => toggle(m)} disabled={pending}>
                    {m.active ? "Retirer l'accès" : "Rétablir"}
                  </Button>
                </div>
              ),
          },
        ]}
      />
      <p className="mt-3 text-xs text-muted">
        « Invitation en attente » : la personne n&apos;a pas encore choisi son mot de passe. « Renvoyer » envoie un nouvel e-mail ; « Copier le lien » vous donne un lien à
        transmettre vous-même. Chaque nouveau lien remplace le précédent.
      </p>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Inviter une personne"
        subtitle={`Elle recevra un e-mail de la part de ${myName} pour activer son accès et choisir son mot de passe.`}
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
          <Field label="Message personnel (facultatif)" hint="Affiché dans l'e-mail et sur la page de bienvenue.">
            <Textarea rows={3} maxLength={600} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex. : Comme convenu, voici l'accès à notre nouvel outil de suivi." />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={!!link}
        onClose={() => setLink(null)}
        title="Lien d'activation"
        subtitle={link ? `Pour ${link.who}, valable 24 h. Il remplace les liens envoyés précédemment.` : ""}
        footer={
          <>
            <Button variant="outline" onClick={() => setLink(null)}>
              Fermer
            </Button>
            <Button onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copié" : "Copier le message"}
            </Button>
          </>
        }
      >
        <p className="mb-2 text-sm text-muted">Envoyez ce lien par SMS, WhatsApp ou e-mail. La personne clique sur « Activer mon accès » puis choisit son mot de passe.</p>
        <textarea readOnly value={link?.url || ""} className="field min-h-[96px] font-mono text-xs break-all" onFocus={(e) => e.target.select()} />
      </Dialog>
    </>
  );
}
