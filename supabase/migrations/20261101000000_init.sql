-- =====================================================================
-- Espace Expédition (Crouzil Boissons) : schéma initial
-- Toutes les personnes invitées (table members) ont les mêmes droits.
-- Chaque modification est tracée (audit_log), les suppressions passent
-- par une corbeille (colonne deleted_at), purgée après 30 jours.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Comptes de l'application
-- ---------------------------------------------------------------------
create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members m where m.id = auth.uid() and m.active);
$$;

-- Toute personne présente dans auth.users a été invitée (inscriptions désactivées) :
-- on lui crée sa fiche membre automatiquement.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.members (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Colonnes communes : horodatage et auteur
-- ---------------------------------------------------------------------
create or replace function public.touch_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Historique des modifications
-- ---------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_email text,
  table_name text not null,
  row_id text not null,
  action text not null check (action in ('create', 'update', 'trash', 'restore', 'delete')),
  label text,
  old_data jsonb,
  new_data jsonb
);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_row_idx on public.audit_log (table_name, row_id);

create or replace function public.row_label(t text, r jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    r ->> 'name', r ->> 'label', r ->> 'client_name', r ->> 'body', r ->> 'title',
    nullif(concat_ws(' ', r ->> 'type', r ->> 'start_date'), ''),
    r ->> 'id'
  );
$$;

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_email text;
begin
  if tg_op = 'INSERT' then
    v_action := 'create';
  elsif tg_op = 'DELETE' then
    v_action := 'delete';
  elsif (v_old ? 'deleted_at') and (v_old ->> 'deleted_at') is null and (v_new ->> 'deleted_at') is not null then
    v_action := 'trash';
  elsif (v_old ? 'deleted_at') and (v_old ->> 'deleted_at') is not null and (v_new ->> 'deleted_at') is null then
    v_action := 'restore';
  else
    v_action := 'update';
    -- On ignore les mises à jour qui ne changent rien d'utile
    if (v_old - 'updated_at' - 'updated_by') = (v_new - 'updated_at' - 'updated_by') then
      return null;
    end if;
  end if;

  select email into v_email from public.members where id = auth.uid();

  insert into public.audit_log (actor, actor_email, table_name, row_id, action, label, old_data, new_data)
  values (
    auth.uid(), v_email, tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'date', '?'),
    v_action,
    left(public.row_label(tg_table_name, v_row), 200),
    v_old, v_new
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Réglages (une seule ligne)
-- ---------------------------------------------------------------------
create table public.settings (
  id smallint primary key default 1 check (id = 1),
  max_abs integer not null default 4,
  max_abs_prep integer not null default 2,
  conformity_target numeric not null default 98,
  repair_contact_name text not null default 'Nicolas',
  repair_contact_email text,
  signature text not null default 'Le service expédition',
  updated_at timestamptz,
  updated_by uuid
);
insert into public.settings (id) values (1);

-- ---------------------------------------------------------------------
-- Collaborateurs (chauffeurs, préparateurs, freelances)
-- ---------------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  job_title text,
  team text not null default 'chauf' check (team in ('chauf', 'prep')),
  freelance boolean not null default false,
  cp_annual numeric not null default 25,
  cp_carryover numeric not null default 0,
  rtt_annual numeric not null default 10,
  rec_due numeric not null default 0,
  sort_order integer not null default 0,
  phone text,
  email text,
  hired_on date,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- Congés et absences
-- ---------------------------------------------------------------------
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  employee_id uuid not null references public.employees (id) on delete cascade,
  type text not null check (type in ('CP', 'RTT', 'REC', 'MAL', 'FOR', 'EVT', 'CSS', 'AUI', 'RDV', 'ABS')),
  start_date date not null,
  end_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  comment text,
  decided_at timestamptz,
  decided_by uuid,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz,
  check (end_date >= start_date)
);
create index leave_requests_dates_idx on public.leave_requests (start_date, end_date);

-- Saisie jour par jour sur le planning (PRES efface une absence)
create table public.day_marks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  date date not null,
  type text not null check (type in ('PRES', 'CP', 'RTT', 'REC', 'MAL', 'FOR', 'EVT', 'CSS', 'AUI', 'RDV', 'ABS')),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  unique (employee_id, date)
);

-- Freelances : déclenché ou non pour une journée
create table public.freelance_calls (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  date date not null,
  triggered boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  unique (employee_id, date)
);

-- ---------------------------------------------------------------------
-- Parc : véhicules et matériel
-- ---------------------------------------------------------------------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  kind text not null default 'VEH' check (kind in ('VEH', 'TRP', 'DIA', 'MAN')),
  name text not null,
  ref text,
  designation text,
  brand text,
  model text,
  tonnage text,
  pallets integer,
  assigned_to text,
  mileage integer,
  ct_due date,
  service_due date,
  insurance_due date,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz
);

create table public.repairs (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  asset_id uuid references public.assets (id) on delete set null,
  kind text not null default 'VEH' check (kind in ('VEH', 'TRP', 'DIA', 'MAN')),
  label text not null,
  category text not null default 'Panne' check (category in ('Panne', 'Casse', 'Usure', 'Sécurité', 'Entretien', 'Autre')),
  urgency text not null default 'Normal' check (urgency in ('Bloquant', 'Urgent', 'Normal')),
  immobilized boolean not null default false,
  status text not null default 'A' check (status in ('A', 'T', 'V', 'R', 'F', 'X')),
  observed_on date not null default current_date,
  expected_back date,
  mileage text,
  description text,
  note text,
  cost numeric,
  closed_on date,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz
);
create index repairs_status_idx on public.repairs (status);

create table public.repair_photos (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references public.repairs (id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- ---------------------------------------------------------------------
-- Clients et erreurs de livraison
-- ---------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  route text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz
);
create unique index clients_name_key on public.clients (upper(name));

create table public.delivery_errors (
  id uuid primary key default gen_random_uuid(),
  import_key text unique,
  date date not null,
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null default '',
  route text,
  driver text,
  goods text,
  qty numeric,
  packaging text,
  error_type text,
  origin text,
  picker text,
  other_resp text,
  comment text,
  source text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz
);
create index delivery_errors_date_idx on public.delivery_errors (date);

-- Nombre de livraisons par jour (pour le taux de conformité)
create table public.delivery_volumes (
  date date primary key,
  deliveries integer not null check (deliveries >= 0),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid
);

create table public.error_justifications (
  id uuid primary key default gen_random_uuid(),
  error_id uuid not null unique references public.delivery_errors (id) on delete cascade,
  q_ordre text,
  q_accord text,
  q_double text,
  q_bon text,
  q_rupture text,
  q_consigne text,
  employee_account text,
  evidence text,
  manager_notes text,
  conclusion text check (conclusion in ('', 'imput', 'partag', 'nonimp')),
  collected_on date,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid
);

-- ---------------------------------------------------------------------
-- Journal de bord et « À la une »
-- ---------------------------------------------------------------------
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  entry_date date not null default current_date,
  category text not null default 'note' check (category in ('evt', 'rem', 'note', 'inc')),
  body text not null,
  author text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'info' check (kind in ('prio', 'new', 'info')),
  tool text,
  body text not null,
  expires_on date,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- Déclencheurs : horodatage + historique
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'employees', 'leave_requests', 'day_marks', 'freelance_calls', 'assets', 'repairs',
    'clients', 'delivery_errors', 'delivery_volumes', 'error_justifications',
    'journal_entries', 'announcements', 'settings'
  ] loop
    if t <> 'settings' then
      execute format('create trigger %I before insert or update on public.%I for each row execute function public.touch_row()', t || '_touch', t);
    end if;
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', t || '_audit', t);
  end loop;
end $$;

create or replace function public.touch_settings()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end; $$;
create trigger settings_touch before update on public.settings for each row execute function public.touch_settings();

-- ---------------------------------------------------------------------
-- Sécurité : seuls les membres actifs lisent et écrivent
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'settings', 'employees', 'leave_requests', 'day_marks', 'freelance_calls', 'assets', 'repairs',
    'repair_photos', 'clients', 'delivery_errors', 'delivery_volumes', 'error_justifications',
    'journal_entries', 'announcements'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())', t || '_members', t);
  end loop;
end $$;

alter table public.members enable row level security;
create policy members_read on public.members for select to authenticated using (public.is_member());
create policy members_update on public.members for update to authenticated using (public.is_member()) with check (public.is_member());

alter table public.audit_log enable row level security;
create policy audit_read on public.audit_log for select to authenticated using (public.is_member());

-- ---------------------------------------------------------------------
-- Corbeille
-- ---------------------------------------------------------------------
create or replace view public.trash
with (security_invoker = true)
as
  select 'employees'::text as table_name, id, name as label, deleted_at, updated_by from public.employees where deleted_at is not null
  union all select 'leave_requests', id, type || ' du ' || to_char(start_date, 'DD/MM/YYYY'), deleted_at, updated_by from public.leave_requests where deleted_at is not null
  union all select 'assets', id, name, deleted_at, updated_by from public.assets where deleted_at is not null
  union all select 'repairs', id, label, deleted_at, updated_by from public.repairs where deleted_at is not null
  union all select 'clients', id, name, deleted_at, updated_by from public.clients where deleted_at is not null
  union all select 'delivery_errors', id, client_name || ' (' || to_char(date, 'DD/MM/YYYY') || ')', deleted_at, updated_by from public.delivery_errors where deleted_at is not null
  union all select 'journal_entries', id, left(body, 80), deleted_at, updated_by from public.journal_entries where deleted_at is not null
  union all select 'announcements', id, left(body, 80), deleted_at, updated_by from public.announcements where deleted_at is not null;

create or replace function public.purge_trash(days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  n integer := 0;
  c integer;
begin
  if auth.uid() is not null and not public.is_member() then
    raise exception 'forbidden';
  end if;
  foreach t in array array['leave_requests', 'repairs', 'delivery_errors', 'journal_entries', 'announcements', 'clients', 'assets', 'employees'] loop
    execute format('delete from public.%I where deleted_at < now() - make_interval(days => $1)', t) using days;
    get diagnostics c = row_count;
    n := n + c;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- Purge automatique de la corbeille (si pg_cron est activé sur le projet)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('purge-trash', '17 3 * * *', 'select public.purge_trash(30)');
  end if;
exception when others then
  raise notice 'pg_cron indisponible, purge manuelle depuis la corbeille';
end $$;
