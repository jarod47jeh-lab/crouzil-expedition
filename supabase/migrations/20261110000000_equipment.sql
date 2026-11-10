-- =====================================================================
-- Tenues et équipements : tailles des collaborateurs, catalogue (EPI, tenue,
-- outils, accès) et dotations nominatives avec émargement et restitution.
-- Droits : menu « equipe » (lecture), éditeurs et administrateurs (écriture).
-- =====================================================================
alter table public.employees add column if not exists size_top text;
alter table public.employees add column if not exists size_bottom text;
alter table public.employees add column if not exists size_shoe text;
alter table public.employees add column if not exists size_gloves text;

create table if not exists public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'tenue' check (category in ('tenue', 'epi', 'outil', 'acces')),
  norm text,
  sized text check (sized in ('top', 'bottom', 'shoe', 'gloves')),
  qty_per_person integer not null default 1,
  renewal_months integer,
  teams text[],
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz
);

create table if not exists public.equipment_issues (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  item_id uuid not null references public.equipment_items (id) on delete cascade,
  size text,
  qty integer not null default 1,
  issued_on date not null default current_date,
  signed boolean not null default false,
  returned_on date,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists equipment_issues_emp_idx on public.equipment_issues (employee_id);
create index if not exists equipment_issues_item_idx on public.equipment_issues (item_id);

do $$
declare t text;
begin
  foreach t in array array['equipment_items', 'equipment_issues'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.touch_row()', t || '_touch', t);
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', t || '_audit', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.has_module(''equipe''))', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write(''equipe''))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_write(''equipe'')) with check (public.can_write(''equipe''))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_write(''equipe''))', t || '_delete', t);
  end loop;
end $$;

create or replace function public.table_module(t text)
returns text language sql immutable set search_path = public as $$
  select case
    when t in ('leave_requests', 'day_marks', 'freelance_calls') then 'conges'
    when t in ('repairs', 'repair_photos') then 'reparations'
    when t = 'assets' then 'parc'
    when t in ('delivery_errors', 'delivery_volumes', 'error_justifications') then 'erreurs'
    when t = 'journal_entries' then 'journal'
    when t in ('employees', 'equipment_items', 'equipment_issues') then 'equipe'
    when t = 'clients' then 'clients'
    when t = 'delivery_notes' then 'remontees'
    when t = 'tasks' then 'taches'
    else 'admin'
  end;
$$;

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
  union all select 'delivery_notes', id, coalesce(client_name || ' : ', '') || left(body, 70), deleted_at, updated_by from public.delivery_notes where deleted_at is not null
  union all select 'tasks', id, left(title, 80), deleted_at, updated_by from public.tasks where deleted_at is not null
  union all select 'equipment_items', id, name, deleted_at, updated_by from public.equipment_items where deleted_at is not null
  union all select 'equipment_issues', i.id, coalesce(it.name, 'Dotation') || ' · ' || coalesce(e.name, ''), i.deleted_at, i.updated_by
    from public.equipment_issues i left join public.equipment_items it on it.id = i.item_id left join public.employees e on e.id = i.employee_id
    where i.deleted_at is not null;

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
  foreach t in array array['leave_requests', 'repairs', 'delivery_errors', 'journal_entries', 'announcements', 'delivery_notes', 'tasks', 'equipment_issues', 'equipment_items', 'clients', 'assets', 'employees'] loop
    execute format('delete from public.%I where deleted_at < now() - make_interval(days => $1)', t) using days;
    get diagnostics c = row_count;
    n := n + c;
  end loop;
  return n;
end;
$$;

-- Catalogue de départ : la proposition « Tenue et équipement des chauffeurs-livreurs »,
-- plus le matériel nominatif déjà distribué (gants bipper, bracelet, téléphone, clé, badge).
insert into public.equipment_items (name, category, norm, sized, qty_per_person, renewal_months, teams, position)
select * from (values
  ('Pantalon de travail', 'tenue', 'Résistant, coupe droite, poches renforcées', 'bottom', 2, 12, array['chauf'], 1),
  ('T-shirt technique', 'tenue', 'Logo Crouzil floqué, respirant', 'top', 3, 12, array['chauf'], 2),
  ('Polo', 'tenue', 'Logo Crouzil brodé, relation client', 'top', 2, 12, array['chauf'], 3),
  ('Polaire ou softshell', 'tenue', 'Logo Crouzil, mi-saison et hiver', 'top', 1, 24, array['chauf'], 4),
  ('Gilet haute visibilité', 'epi', 'EN ISO 20471, classe 2 minimum', 'top', 1, 24, array['chauf'], 5),
  ('Chaussures de sécurité', 'epi', 'EN ISO 20345, coque + semelle anti-perforation', 'shoe', 1, 15, array['chauf'], 6),
  ('Gants de manutention', 'epi', 'EN 388, protection mécanique', 'gloves', 2, 6, array['chauf'], 7),
  ('Lampe frontale', 'outil', 'Départs avant le lever du jour', null, 1, null, array['chauf'], 8),
  ('Casquette', 'tenue', 'Logo Crouzil, saison chaude', null, 1, 12, array['chauf'], 9),
  ('Bonnet', 'tenue', 'Logo Crouzil, saison froide', null, 1, 12, array['chauf'], 10),
  ('Gants bipper', 'outil', 'Scanner au poignet', null, 1, null, array['chauf', 'prep'], 11),
  ('Bracelet', 'outil', 'Porté au poignet avec le bipper', null, 1, null, array['chauf', 'prep'], 12),
  ('Téléphone professionnel', 'outil', null, null, 1, null, null, 13),
  ('Clé', 'acces', null, null, 1, null, null, 14),
  ('Badge', 'acces', null, null, 1, null, null, 15)
) as v(name, category, norm, sized, qty_per_person, renewal_months, teams, position)
where not exists (select 1 from public.equipment_items);
