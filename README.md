# Espace Expédition · Crouzil Boissons

Application web du service expédition : remontées livraison, présences et congés, réparations du parc, erreurs de livraison, journal de bord, avec fiches collaborateurs, véhicules et clients, tableaux de bord et historique complet.

Accès **sur invitation**, réservé aux responsables et à la direction. Chaque compte a un rôle et une liste de menus visibles (voir [Rôles et menus](#rôles-et-menus)).

## Fonctionnalités

| Module | Ce qu'on peut faire |
|---|---|
| **Tableau de bord** | Indicateurs du jour (absents, congés à valider, réparations, conformité, erreurs d'hier), messages « À la une », absences des 10 prochains jours, erreurs des 8 dernières semaines, points d'attention, activité récente |
| **Remontées livraison** | Particularités des prochaines livraisons et récupérations remontées par les commerciaux, clients, direction, livreurs ou préparateurs : niveau (Attention / Info), client, date ou consigne permanente, tournée, provenance. Regroupées par échéance (en retard, aujourd'hui, demain…), suivi « À traiter → Pris en compte → Clos », reprises sur le tableau de bord et dans la fiche client |
| **Présences et congés** | Équipes Chauffeurs, Préparateurs, Service Commande et Bureau Direction. Vue du jour (statut de chacun, freelances déclenchés), planning mensuel avec saisie rapide au pinceau, demandes (création, validation et refus en un clic, annulation possible), soldes CP / RTT / récupération, statistiques et taux d'absentéisme. Jours fériés calculés automatiquement, alerte au-delà du seuil d'absents |
| **Réparations** | Tableau de bord (ouvertes, bloquantes, délai moyen, coût), liste filtrable, fiche avec suivi du statut en un clic et photos (prises directement au téléphone), message prêt à envoyer au responsable atelier |
| **Erreurs de livraison** | Jauges de conformité (global, préparation, livraison) face à l'objectif, évolution mensuelle, classements, import du fichier `Suivi_Erreurs.xlsx` sans doublon, saisie des volumes livrés, justifications de l'employé |
| **To do list** | Tâches regroupées par rubrique (« Cette semaine », « D'ici fin novembre »…), cochées en un clic, avec échéance, personne concernée et précisions. Les tâches faites se replient sous « Fait », celles en retard ou du jour sont signalées dans le menu |
| **Journal de bord** | Événements, remarques, incidents et notes, avec recherche et filtres |
| **Équipe / Parc / Clients** | Fiches complètes : soldes et absences du collaborateur, réparations et échéances du véhicule (CT, entretien, assurance), erreurs et consignes de livraison du client |
| **Administration** | Historique de toutes les modifications (qui, quoi, quand), corbeille restaurable 30 jours, invitation des comptes avec rôle et menus, désactivation, réglages |

Partout : recherche globale (`Ctrl + K` / `⌘K`), exports Excel et CSV, mode sombre, affichage adapté au téléphone.

## Rôles et menus

| Rôle | Droits |
|---|---|
| **Administrateur** | Tout, y compris Utilisateurs, Réglages, Historique complet et Corbeille |
| **Éditeur** | Crée, modifie et supprime dans ses menus |
| **Contributeur** | Ajoute des remontées livraison (et modifie les siennes), consulte le reste de ses menus |
| **Lecteur** | Consulte seulement |

Pour chaque compte (hors administrateur), l'administrateur coche les menus visibles dans **Utilisateurs › Droits**. Les règles sont appliquées dans la base (RLS) : un menu masqué ne peut pas non plus être lu par un autre moyen.

## Technique

- **Next.js 15** (App Router, Server Actions) et **TypeScript**
- **Supabase** : base Postgres, connexion par e-mail et mot de passe, stockage des photos
- **Tailwind CSS 4**, **Motion** pour les animations, **Recharts** pour les graphiques
- Sécurité dans la base (Row Level Security) : sans compte membre actif, on ne lit ni n'écrit rien
- Historique et corbeille gérés par des déclencheurs SQL, donc impossibles à contourner depuis l'interface

```
src/app/(app)/        pages de l'application (une par module)
src/components/       interface (tableaux, formulaires, graphiques, menu)
src/lib/actions/      écritures (Server Actions)
src/lib/domain/       règles métier : jours ouvrés, soldes, conformité…
supabase/migrations/  schéma SQL
scripts/              reprise des données de l'ancien artefact
```

---

## Mise en ligne (environ 20 minutes)

### 1. Créer la base Supabase

1. Créez un compte sur [supabase.com](https://supabase.com), puis **New project**. Choisissez la région **West EU (Paris)** et notez le mot de passe de la base.
2. Dans **SQL Editor**, exécutez l'un après l'autre le contenu des fichiers :
   - `supabase/migrations/20261101000000_init.sql`
   - `supabase/migrations/20261101000001_storage.sql`
   - `supabase/migrations/20261102000000_invite_only.sql`
   - `supabase/migrations/20261102000001_harden_functions.sql`
   - `supabase/migrations/20261102000002_onboarding.sql`
   - `supabase/migrations/20261103000000_roles_and_delivery_notes.sql`
   - `supabase/migrations/20261103000001_teams_office.sql`
   - `supabase/migrations/20261106000000_tasks.sql`
3. Dans **Authentication › Sign In / Providers** : désactivez **Allow new users to sign up**. Seules les personnes invitées pourront entrer.
4. Dans **Project Settings › API**, copiez l'**URL**, la clé **anon public** et la clé **service_role**.
5. (Recommandé) Dans **Database › Extensions**, activez **pg_cron**, puis relancez la fin du fichier `init.sql` (bloc « Purge automatique »). La corbeille se videra alors toute seule après 30 jours. Sinon, un bouton le fait dans la page Corbeille.

> **E-mails d'invitation** : l'envoi intégré de Supabase est limité à quelques e-mails par heure. Pour inviter toute l'équipe sans attendre, branchez un SMTP gratuit (Brevo, Resend…) dans **Authentication › Emails › SMTP Settings**.

### 2. Mettre le site en ligne avec Vercel

1. Créez un compte sur [vercel.com](https://vercel.com) avec votre compte GitHub, puis **Add New › Project** et choisissez `crouzil-expedition`.
2. Dans **Environment Variables**, ajoutez :

   | Nom | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | l'URL du projet Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé anon public |
   | `SUPABASE_SERVICE_ROLE_KEY` | la clé service_role (reste côté serveur) |
   | `NEXT_PUBLIC_SITE_URL` | l'adresse du site, par exemple `https://crouzil-expedition.vercel.app` |

3. Cliquez sur **Deploy**. L'adresse du site s'affiche à la fin.
4. De retour dans Supabase, **Authentication › URL Configuration** :
   - **Site URL** : l'adresse Vercel
   - **Redirect URLs** : ajoutez `https://VOTRE-ADRESSE.vercel.app/**`

### Invitations : e-mails personnalisés et lien valable 24 h

1. **Authentication › Emails › Templates** : remplacez le modèle **Invite user** par le contenu de
   `supabase/templates/invite.html` (sujet : `{{ .Data.invited_by }} vous invite sur l'Espace Expédition`)
   et le modèle **Reset password** par `supabase/templates/recovery.html` (sujet : `Espace Expédition : choisissez votre mot de passe`).
   Le lien mène à une page « Activer mon accès » : il n'est consommé qu'au clic, les antivirus de messagerie ne peuvent plus le griller.
2. **Authentication › Sign In / Providers › Email** : réglez **Email OTP Expiration** sur `86400` (24 h, le maximum).

Dans l'appli, la page **Utilisateurs** propose aussi « Renvoyer » et « Copier le lien » (à envoyer par SMS ou WhatsApp)
pour toute invitation en attente. À la première connexion, la personne doit choisir son mot de passe.

### 3. Créer le premier compte

Dans Supabase, **Authentication › Users › Add user › Create new user** : votre e-mail et un mot de passe, en cochant **Auto Confirm User**. Connectez-vous sur le site. Les comptes suivants s'invitent ensuite depuis la page **Utilisateurs** de l'application.

### 4. Reprendre les données de l'artefact

Le dossier d'export (un sous-dossier par collection : `team`, `requests`, `repairs`, `errors`…) se place à la racine du projet, sous le nom `export/`. Il est ignoré par Git : les données personnelles ne sont jamais publiées sur GitHub.

```bash
cp .env.example .env.local   # puis renseignez l'URL et la clé service_role
npm install
npm run import:artifact -- ./export
```

Le script peut être relancé sans risque : il met à jour ce qui existe déjà au lieu de créer des doublons. Il reprend l'équipe et les soldes, les congés, le planning, les freelances, le parc, les réparations avec leurs photos, les erreurs de livraison avec les clients et les volumes livrés, les justifications, le journal et les messages « À la une ».

---

## Développement local

```bash
npm install
cp .env.example .env.local   # avec les clés d'un projet Supabase de test
npm run dev                  # http://localhost:3000
```

Vérifications avant de publier :

```bash
npm run typecheck && npm run lint && npm run build
```

## Mise à jour du fichier Excel des erreurs

Page **Erreurs de livraison › Import et volumes** : glissez le fichier `Suivi_Erreurs.xlsx`. L'appli lit les onglets mois (`09-Sep`, `10-Oct`…), où elle repère toute seule la ligne d'en-têtes (DATE, CLIENT, TYPE D'ERREUR…), et l'onglet **Activité** (nombre de livraisons par jour). Un aperçu indique les nouvelles lignes avant l'enregistrement.

## Environnement en production

- Site : https://crouzil-expedition.vercel.app (Vercel, fonctions à Paris `cdg1`)
- Base : projet Supabase `crouzil-expedition` (région Paris `eu-west-3`)
- Chaque push sur `main` est publié automatiquement.
