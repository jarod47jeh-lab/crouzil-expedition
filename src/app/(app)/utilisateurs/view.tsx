"use client";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  KeyRound,
  Link2,
  MailPlus,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import {
  inviteLink,
  inviteMember,
  resendInvite,
  setMemberAccess,
  setMemberActive,
} from "@/lib/actions/auth";
import { fmtDateTime } from "@/lib/domain/dates";
import { MODULES, ROLES, type ModuleKey, type Role } from "@/lib/perms";
import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils";

type Access = { role: Role; modules: ModuleKey[] | null };
const ROLE_TONE: Record<Role, "violet" | "ok" | "warn" | "muted"> = {
  admin: "violet",
  editor: "ok",
  contributor: "warn",
  reader: "muted",
};

/** Choix du rôle et des menus visibles */
function AccessFields({
  value,
  onChange,
  lockAdmin,
}: {
  value: Access;
  onChange: (a: Access) => void;
  lockAdmin?: boolean;
}) {
  const all = value.modules == null;
  const list = value.modules ?? MODULES.map((m) => m.key);
  const toggle = (k: ModuleKey) => {
    const next = list.includes(k) ? list.filter((x) => x !== k) : [...list, k];
    onChange({
      ...value,
      modules: next.length === MODULES.length ? null : next,
    });
  };
  return (
    <div className="grid gap-4">
      <div>
        <p className="mb-2 text-sm font-semibold">Rôle</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(ROLES) as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              disabled={lockAdmin && r !== "admin"}
              onClick={() => onChange({ ...value, role: r })}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                value.role === r
                  ? "border-brand bg-brand/8 ring-1 ring-brand"
                  : "border-line hover:border-ink/30",
              )}
            >
              <span className="block text-sm font-bold">{ROLES[r].label}</span>
              <span className="block text-xs text-muted">{ROLES[r].help}</span>
            </button>
          ))}
        </div>
        {lockAdmin && (
          <p className="mt-2 text-xs text-muted">
            Vous ne pouvez pas retirer votre propre rôle d&apos;administrateur.
          </p>
        )}
      </div>
      {value.role !== "admin" && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Menus visibles</p>
            <button
              type="button"
              className="text-xs font-semibold text-brand"
              onClick={() => onChange({ ...value, modules: all ? [] : null })}
            >
              {all ? "Tout décocher" : "Tout cocher"}
            </button>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {MODULES.map((m) => (
              <label
                key={m.key}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-ink/4"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-brand)]"
                  checked={list.includes(m.key)}
                  onChange={() => toggle(m.key)}
                />
                {m.label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Le tableau de bord et les messages « À la une » restent visibles par
            tous.
          </p>
        </div>
      )}
    </div>
  );
}

export function UsersView({
  members,
  me,
  myName,
  canInvite,
}: {
  members: Member[];
  me: string;
  myName: string;
  canInvite: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState<{ who: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [access, setAccess] = useState<Access>({
    role: "editor",
    modules: null,
  });
  const [editing, setEditing] = useState<Member | null>(null);
  const [editAccess, setEditAccess] = useState<Access>({
    role: "reader",
    modules: null,
  });
  const openAccess = (m: Member) => {
    setEditing(m);
    setEditAccess({
      role: (m.role as Role) || "reader",
      modules: (m.modules as ModuleKey[] | null) ?? null,
    });
  };
  const saveAccess = () =>
    start(async () => {
      if (!editing) return;
      const res = await setMemberAccess(
        editing.id,
        editAccess.role,
        editAccess.modules,
      );
      if (!res.ok) return void toast.error(res.error);
      toast.success(
        `Droits de ${editing.full_name || editing.email} mis à jour`,
      );
      setEditing(null);
      router.refresh();
    });

  const invite = () =>
    start(async () => {
      const res = await inviteMember(
        email,
        name,
        message,
        access.role,
        access.modules,
      );
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Invitation envoyée à ${email}`);
      setOpen(false);
      setEmail("");
      setName("");
      setMessage("");
      setAccess({ role: "editor", modules: null });
      router.refresh();
    });
  const resend = (m: Member) =>
    start(async () => {
      const res = await resendInvite(m.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(
        res.data?.kind === "invite"
          ? `Nouvelle invitation envoyée à ${m.email}`
          : `E-mail envoyé à ${m.email} pour choisir son mot de passe`,
      );
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
        subtitle="Responsables et direction : rôle et menus visibles compte par compte"
        actions={
          <Button
            onClick={() => setOpen(true)}
            disabled={!canInvite}
            title={
              canInvite
                ? ""
                : "Clé SUPABASE_SERVICE_ROLE_KEY manquante sur le serveur"
            }
          >
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
                {m.id === me && (
                  <span className="ml-2 text-xs font-normal text-muted">
                    (vous)
                  </span>
                )}
              </b>
            ),
          },
          {
            key: "email",
            header: "E-mail",
            hideOnMobile: true,
            sort: (m) => m.email,
            cell: (m) => m.email,
          },
          {
            key: "role",
            header: "Rôle et menus",
            sort: (m) => Object.keys(ROLES).indexOf(m.role),
            exportValue: (m) => ROLES[m.role as Role]?.label || m.role,
            cell: (m) => (
              <div className="flex max-w-[300px] flex-wrap items-center gap-1">
                <Badge tone={ROLE_TONE[m.role as Role] || "muted"}>
                  {ROLES[m.role as Role]?.label || m.role}
                </Badge>
                {m.role !== "admin" &&
                  (m.modules == null ? (
                    <span className="text-xs text-muted">tous les menus</span>
                  ) : m.modules.length ? (
                    <span className="text-xs text-muted">
                      {MODULES.filter((x) => m.modules!.includes(x.key))
                        .map((x) => x.label)
                        .join(", ")}
                    </span>
                  ) : (
                    <span className="text-xs text-bad">aucun menu</span>
                  ))}
              </div>
            ),
          },
          {
            key: "seen",
            header: "Dernière visite",
            hideOnMobile: true,
            sort: (m) => m.last_seen_at || "",
            cell: (m) => (
              <span className="text-muted">
                {m.last_seen_at
                  ? fmtDateTime(m.last_seen_at)
                  : "jamais connecté"}
              </span>
            ),
          },
          {
            key: "st",
            header: "Accès",
            sort: (m) => (m.active ? (m.password_set ? 2 : 1) : 0),
            cell: (m) =>
              !m.active ? (
                <Badge tone="muted" dot>
                  Désactivé
                </Badge>
              ) : m.password_set ? (
                <Badge tone="ok" dot>
                  Actif
                </Badge>
              ) : (
                <Badge tone="warn" dot>
                  Invitation en attente
                </Badge>
              ),
          },
          {
            key: "act",
            header: "",
            cell: (m) => (
              <div className="flex flex-wrap justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openAccess(m)}
                  disabled={pending}
                  title="Rôle et menus visibles"
                >
                  <KeyRound className="h-3.5 w-3.5" /> Droits
                </Button>
                {m.id !== me && (
                  <>
                    {m.active && !m.password_set && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => resend(m)}
                          disabled={pending || !canInvite}
                          title="Renvoyer l'e-mail d'invitation"
                        >
                          <Send className="h-3.5 w-3.5" /> Renvoyer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => makeLink(m)}
                          disabled={pending || !canInvite}
                          title="Obtenir un lien à envoyer par SMS ou WhatsApp"
                        >
                          <Link2 className="h-3.5 w-3.5" /> Copier le lien
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant={m.active ? "danger" : "secondary"}
                      onClick={() => toggle(m)}
                      disabled={pending}
                    >
                      {m.active ? "Retirer l'accès" : "Rétablir"}
                    </Button>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
      <p className="mt-3 text-xs text-muted">
        « Invitation en attente » : la personne n&apos;a pas encore choisi son
        mot de passe. « Renvoyer » envoie un nouvel e-mail ; « Copier le lien »
        vous donne un lien à transmettre vous-même. Chaque nouveau lien remplace
        le précédent.
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
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Nom et prénom">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field
            label="Message personnel (facultatif)"
            hint="Affiché dans l'e-mail et sur la page de bienvenue."
          >
            <Textarea
              rows={3}
              maxLength={600}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex. : Comme convenu, voici l'accès à notre nouvel outil de suivi."
            />
          </Field>
          <AccessFields value={access} onChange={setAccess} />
        </div>
      </Dialog>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Droits d'accès"
        subtitle={
          editing
            ? `${editing.full_name || editing.email} : ce qu'il ou elle peut voir et modifier.`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button onClick={saveAccess} loading={pending}>
              Enregistrer
            </Button>
          </>
        }
      >
        <AccessFields
          value={editAccess}
          onChange={setEditAccess}
          lockAdmin={editing?.id === me && editing?.role === "admin"}
        />
      </Dialog>

      <Dialog
        open={!!link}
        onClose={() => setLink(null)}
        title="Lien d'activation"
        subtitle={
          link
            ? `Pour ${link.who}, valable 24 h. Il remplace les liens envoyés précédemment.`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setLink(null)}>
              Fermer
            </Button>
            <Button onClick={copy}>
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}{" "}
              {copied ? "Copié" : "Copier le message"}
            </Button>
          </>
        }
      >
        <p className="mb-2 text-sm text-muted">
          Envoyez ce lien par SMS, WhatsApp ou e-mail. La personne clique sur «
          Activer mon accès » puis choisit son mot de passe.
        </p>
        <textarea
          readOnly
          value={link?.url || ""}
          className="field min-h-[96px] font-mono text-xs break-all"
          onFocus={(e) => e.target.select()}
        />
      </Dialog>
    </>
  );
}
