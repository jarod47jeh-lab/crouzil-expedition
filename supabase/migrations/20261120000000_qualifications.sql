-- =====================================================================
-- Qualifications, certifications et formations (CACES, SST, FCO, FIMO,
-- permis, carte conducteur…) : catalogue + qualification de chaque
-- collaborateur avec date d'obtention et d'échéance.
-- Droits : menu « equipe » (lecture), éditeurs et administrateurs (écriture).
-- RTT : 0 par défaut pour les nouveaux collaborateurs.
-- =====================================================================
alter table public.employees alter column rtt_annual set default 0;

create table if not exists public.qualification_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'caces' check (category in ('caces', 'conduite', 'secours', 'securite', 'autre')),
  validity_months integer,
  teams text[],
  required boolean not null default false,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz
);

create table if not exists public.qualifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  type_id uuid not null references public.qualification_types (id) on delete cascade,
  obtained_on date,
  expires_on date,
  provider text,
  reference text,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists qualifications_emp_idx on public.qualifications (employee_id);
create index if not exists qualifications_type_idx on public.qualifications (type_id);

do $$
declare t text;
begin
  foreach t in array array['qualification_types', 'qualifications'] loop
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

-- Historique : rattacher les tables au menu
create or replace function public.table_module(t text)
returns text language sql immutable set search_path = public as $$
  select case
    when t in ('leave_requests', 'day_marks', 'freelance_calls') then 'conges'
    when t in ('repairs', 'repair_photos') then 'reparations'
    when t = 'assets' then 'parc'
    when t in ('delivery_errors', 'delivery_volumes', 'error_justifications') then 'erreurs'
    when t = 'journal_entries' then 'journal'
    when t in ('employees', 'equipment_items', 'equipment_issues', 'qualification_types', 'qualifications') then 'equipe'
    when t = 'clients' then 'clients'
    when t = 'delivery_notes' then 'remontees'
    when t = 'tasks' then 'taches'
    else 'admin'
  end;
$$;

-- Corbeille
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
    where i.deleted_at is not null
  union all select 'qualification_types', id, name, deleted_at, updated_by from public.qualification_types where deleted_at is not null
  union all select 'qualifications', q.id, coalesce(t.name, 'Qualification') || ' · ' || coalesce(e.name, ''), q.deleted_at, q.updated_by
    from public.qualifications q left join public.qualification_types t on t.id = q.type_id left join public.employees e on e.id = q.employee_id
    where q.deleted_at is not null;

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
  foreach t in array array['leave_requests', 'repairs', 'delivery_errors', 'journal_entries', 'announcements', 'delivery_notes', 'tasks', 'equipment_issues', 'equipment_items', 'qualifications', 'qualification_types', 'clients', 'assets', 'employees'] loop
    execute format('delete from public.%I where deleted_at < now() - make_interval(days => $1)', t) using days;
    get diagnostics c = row_count;
    n := n + c;
  end loop;
  return n;
end;
$$;

-- Catalogue de départ (durées de validité usuelles, modifiables dans l'appli)
insert into public.qualification_types (name, category, validity_months, teams, required, position)
select * from (values
  ('CACES R489 cat. 1A (transpalette à conducteur porté)', 'caces', 60, array['prep', 'chauf'], false, 1),
  ('CACES R489 cat. 1B (gerbeur à conducteur porté)', 'caces', 60, array['prep'], false, 2),
  ('CACES R489 cat. 3 (chariot frontal ≤ 6 t)', 'caces', 60, array['prep', 'chauf'], true, 3),
  ('CACES R489 cat. 5 (chariot à mât rétractable)', 'caces', 60, array['prep'], false, 4),
  ('CACES R485 (gerbeur à conducteur accompagnant)', 'caces', 60, array['prep'], false, 5),
  ('CACES R490 (grue auxiliaire de chargement)', 'caces', 60, array['chauf'], false, 6),
  ('Permis C (poids lourd)', 'conduite', 60, array['chauf'], true, 10),
  ('Permis CE (super lourd)', 'conduite', 60, array['chauf'], false, 11),
  ('FIMO marchandises', 'conduite', null, array['chauf'], false, 12),
  ('FCO marchandises', 'conduite', 60, array['chauf'], true, 13),
  ('Carte conducteur (chronotachygraphe)', 'conduite', 60, array['chauf'], true, 14),
  ('ADR (matières dangereuses)', 'conduite', 60, array['chauf'], false, 15),
  ('SST Sauveteur secouriste du travail', 'secours', 24, array['prep', 'chauf'], false, 20),
  ('Équipier de première intervention (incendie)', 'securite', 12, array['prep', 'chauf'], false, 30),
  ('Gestes et postures', 'securite', null, array['prep', 'chauf'], false, 31),
  ('Visite médicale d''aptitude', 'autre', 24, array['prep', 'chauf'], false, 40)
) as v(name, category, validity_months, teams, required, position)
where not exists (select 1 from public.qualification_types);
