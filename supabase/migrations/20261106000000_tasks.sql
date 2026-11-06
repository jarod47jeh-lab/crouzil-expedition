-- =====================================================================
-- To do list : tâches regroupées par rubrique, cochées quand elles sont faites.
-- Lecture : menu « taches » ; écriture : administrateurs et éditeurs ayant ce menu.
-- =====================================================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  section text not null default 'À faire',
  notes text,
  due_date date,
  assignee text,
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists tasks_section_idx on public.tasks (section, position);

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before insert or update on public.tasks
  for each row execute function public.touch_row();
drop trigger if exists tasks_audit on public.tasks;
create trigger tasks_audit after insert or update or delete on public.tasks
  for each row execute function public.audit_row();
alter table public.tasks enable row level security;

drop policy if exists tasks_read on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;
create policy tasks_read on public.tasks for select to authenticated using (public.has_module('taches'));
create policy tasks_insert on public.tasks for insert to authenticated with check (public.can_write('taches'));
create policy tasks_update on public.tasks for update to authenticated using (public.can_write('taches')) with check (public.can_write('taches'));
create policy tasks_delete on public.tasks for delete to authenticated using (public.can_write('taches'));

-- Historique : rattacher la table au menu
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
  union all select 'tasks', id, left(title, 80), deleted_at, updated_by from public.tasks where deleted_at is not null;

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
  foreach t in array array['leave_requests', 'repairs', 'delivery_errors', 'journal_entries', 'announcements', 'delivery_notes', 'tasks', 'clients', 'assets', 'employees'] loop
    execute format('delete from public.%I where deleted_at < now() - make_interval(days => $1)', t) using days;
    get diagnostics c = row_count;
    n := n + c;
  end loop;
  return n;
end;
$$;
