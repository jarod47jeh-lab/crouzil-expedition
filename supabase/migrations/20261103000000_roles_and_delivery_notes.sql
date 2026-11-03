-- =====================================================================
-- Rôles (admin, éditeur, contributeur, lecteur), menus visibles par compte
-- et module « Remontées livraison ».
-- Les droits sont appliqués par la base (RLS) : l'interface ne fait que suivre.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Rôles et menus des comptes
-- ---------------------------------------------------------------------
alter table public.members add column if not exists role text not null default 'reader'
  check (role in ('admin', 'editor', 'contributor', 'reader'));
-- null = tous les menus ; sinon liste des menus autorisés
alter table public.members add column if not exists modules text[];

-- Comptes existants : éditeurs, et le premier compte devient administrateur
update public.members set role = 'editor' where role = 'reader';
update public.members set role = 'admin'
where id = (select id from public.members order by created_at limit 1);

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.members where id = auth.uid() and active;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false);
$$;

-- Accès en lecture à un menu
create or replace function public.has_module(m text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where id = auth.uid() and active
      and (role = 'admin' or modules is null or m = any (modules))
  );
$$;

-- Droit de modification dans un menu (admin ou éditeur ayant le menu)
create or replace function public.can_write(m text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_module(m) and public.my_role() in ('admin', 'editor');
$$;

-- Menu auquel appartient chaque table (pour l'historique)
create or replace function public.table_module(t text)
returns text language sql immutable set search_path = public as $$
  select case
    when t in ('leave_requests', 'day_marks', 'freelance_calls') then 'conges'
    when t in ('repairs', 'repair_photos') then 'reparations'
    when t = 'assets' then 'parc'
    when t in ('delivery_errors', 'delivery_volumes', 'error_justifications') then 'erreurs'
    when t = 'journal_entries' then 'journal'
    when t = 'employees' then 'equipe'
    when t = 'clients' then 'clients'
    when t = 'delivery_notes' then 'remontees'
    else 'admin'
  end;
$$;

revoke execute on function public.my_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.has_module(text) from public, anon;
revoke execute on function public.can_write(text) from public, anon;
grant execute on function public.my_role(), public.is_admin(), public.has_module(text), public.can_write(text) to authenticated;

-- Un compte non administrateur ne peut pas changer son propre rôle, ses menus ni son statut
create or replace function public.protect_member_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.modules := old.modules;
    new.active := old.active;
    new.email := old.email;
  end if;
  return new;
end;
$$;
revoke execute on function public.protect_member_fields() from public, anon, authenticated;
drop trigger if exists members_protect on public.members;
create trigger members_protect before update on public.members
  for each row execute function public.protect_member_fields();

-- ---------------------------------------------------------------------
-- 2. Remontées livraison
-- ---------------------------------------------------------------------
create table if not exists public.delivery_notes (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'attention' check (level in ('attention', 'info')),
  kind text not null default 'livraison' check (kind in ('livraison', 'recuperation', 'les_deux', 'autre')),
  client_id uuid references public.clients (id) on delete set null,
  client_name text,
  due_date date,
  until_date date,
  permanent boolean not null default false,
  route text,
  source text not null default 'commercial' check (source in ('commercial', 'client', 'direction', 'livreur', 'preparateur', 'autre')),
  source_name text,
  body text not null,
  status text not null default 'todo' check (status in ('todo', 'ack', 'done')),
  handled_at timestamptz,
  handled_by uuid,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists delivery_notes_due_idx on public.delivery_notes (due_date);
create index if not exists delivery_notes_client_idx on public.delivery_notes (client_id);

drop trigger if exists delivery_notes_touch on public.delivery_notes;
create trigger delivery_notes_touch before insert or update on public.delivery_notes
  for each row execute function public.touch_row();
drop trigger if exists delivery_notes_audit on public.delivery_notes;
create trigger delivery_notes_audit after insert or update or delete on public.delivery_notes
  for each row execute function public.audit_row();
alter table public.delivery_notes enable row level security;

-- Libellé dans l'historique
create or replace function public.row_label(t text, r jsonb)
returns text language sql immutable set search_path = public as $$
  select coalesce(
    r ->> 'name', r ->> 'label', r ->> 'client_name', r ->> 'body', r ->> 'title',
    nullif(concat_ws(' ', r ->> 'type', r ->> 'start_date'), ''),
    r ->> 'id'
  );
$$;

-- « À la une » : nouveau type Attention
alter table public.announcements drop constraint if exists announcements_kind_check;
alter table public.announcements add constraint announcements_kind_check check (kind in ('prio', 'attn', 'new', 'info'));

-- Corbeille : inclure les remontées
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
  union all select 'announcements', id, left(body, 80), deleted_at, updated_by from public.announcements where deleted_at is not null
  union all select 'delivery_notes', id, coalesce(client_name || ' : ', '') || left(body, 70), deleted_at, updated_by from public.delivery_notes where deleted_at is not null;

create or replace function public.purge_trash(days integer default 30)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  t text;
  n integer := 0;
  c integer;
begin
  if session_user not in ('postgres', 'supabase_admin') and not public.is_admin() then
    raise exception 'forbidden';
  end if;
  foreach t in array array['leave_requests', 'repairs', 'delivery_errors', 'journal_entries', 'announcements', 'delivery_notes', 'clients', 'assets', 'employees'] loop
    execute format('delete from public.%I where deleted_at < now() - make_interval(days => $1)', t) using days;
    get diagnostics c = row_count;
    n := n + c;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Règles d'accès par table
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'settings', 'employees', 'leave_requests', 'day_marks', 'freelance_calls', 'assets', 'repairs',
    'repair_photos', 'clients', 'delivery_errors', 'delivery_volumes', 'error_justifications',
    'journal_entries', 'announcements'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_members', t);
  end loop;
end $$;

-- Lecture R, écriture W (insert/update/delete)
create or replace function pg_temp.policies(t text, r text, w text) returns void language plpgsql as $$
begin
  execute format('create policy %I on public.%I for select to authenticated using (%s)', t || '_read', t, r);
  execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_insert', t, w);
  execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_update', t, w, w);
  execute format('create policy %I on public.%I for delete to authenticated using (%s)', t || '_delete', t, w);
end $$;

select pg_temp.policies('settings',             'public.is_member()', 'public.is_admin()');
select pg_temp.policies('employees',            'public.is_member()', 'public.can_write(''equipe'')');
select pg_temp.policies('leave_requests',       'public.has_module(''conges'')', 'public.can_write(''conges'')');
select pg_temp.policies('day_marks',            'public.has_module(''conges'')', 'public.can_write(''conges'')');
select pg_temp.policies('freelance_calls',      'public.has_module(''conges'')', 'public.can_write(''conges'')');
select pg_temp.policies('assets',               'public.is_member()', 'public.can_write(''parc'')');
select pg_temp.policies('repairs',              'public.has_module(''reparations'') or public.has_module(''parc'')', 'public.can_write(''reparations'')');
select pg_temp.policies('repair_photos',        'public.has_module(''reparations'') or public.has_module(''parc'')', 'public.can_write(''reparations'')');
select pg_temp.policies('clients',              'public.is_member()', 'public.can_write(''clients'') or public.can_write(''erreurs'')');
select pg_temp.policies('delivery_errors',      'public.has_module(''erreurs'') or public.has_module(''clients'')', 'public.can_write(''erreurs'')');
select pg_temp.policies('delivery_volumes',     'public.has_module(''erreurs'')', 'public.can_write(''erreurs'')');
select pg_temp.policies('error_justifications', 'public.has_module(''erreurs'')', 'public.can_write(''erreurs'')');
select pg_temp.policies('journal_entries',      'public.has_module(''journal'')', 'public.can_write(''journal'')');
select pg_temp.policies('announcements',        'public.is_member()', 'public.my_role() in (''admin'', ''editor'')');

-- Remontées : les contributeurs ajoutent et modifient les leurs, les éditeurs traitent tout
create policy delivery_notes_read on public.delivery_notes for select to authenticated
  using (public.has_module('remontees') or public.has_module('clients'));
create policy delivery_notes_insert on public.delivery_notes for insert to authenticated
  with check (public.has_module('remontees') and public.my_role() in ('admin', 'editor', 'contributor'));
create policy delivery_notes_update on public.delivery_notes for update to authenticated
  using (public.can_write('remontees') or (public.has_module('remontees') and public.my_role() = 'contributor' and created_by = auth.uid()))
  with check (public.can_write('remontees') or (public.has_module('remontees') and public.my_role() = 'contributor' and created_by = auth.uid()));
create policy delivery_notes_delete on public.delivery_notes for delete to authenticated
  using (public.can_write('remontees'));

-- Comptes : tout le monde lit la liste, seul un admin modifie les autres
drop policy if exists members_read on public.members;
drop policy if exists members_update on public.members;
create policy members_read on public.members for select to authenticated using (public.is_member());
create policy members_update on public.members for update to authenticated
  using (public.is_admin() or id = auth.uid()) with check (public.is_admin() or id = auth.uid());

-- Historique : admin, ou personnes ayant accès au menu concerné
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated
  using (public.is_admin() or (table_name <> 'settings' and public.has_module(public.table_module(table_name))));

-- Photos des réparations
drop policy if exists repair_photos_read on storage.objects;
drop policy if exists repair_photos_write on storage.objects;
drop policy if exists repair_photos_delete on storage.objects;
create policy repair_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'repair-photos' and (public.has_module('reparations') or public.has_module('parc')));
create policy repair_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'repair-photos' and public.can_write('reparations'));
create policy repair_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'repair-photos' and public.can_write('reparations'));

-- Nouveaux comptes : le tout premier est administrateur, les invités démarrent en lecteur
-- (l'écran d'invitation applique ensuite le rôle et les menus choisis).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first boolean := not exists (select 1 from public.members);
begin
  insert into public.members (id, email, full_name, active, password_set, invited_by, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    v_first or new.invited_at is not null,
    v_first,
    new.raw_user_meta_data ->> 'invited_by',
    case when v_first then 'admin' else 'reader' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
