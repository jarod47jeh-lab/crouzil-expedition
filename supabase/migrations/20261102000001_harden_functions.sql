-- Durcissement signalé par le linter de sécurité Supabase.

-- 1. search_path figé sur les fonctions utilitaires
alter function public.touch_row() set search_path = public;
alter function public.touch_settings() set search_path = public;
alter function public.row_label(text, jsonb) set search_path = public;

-- 2. Les fonctions de déclencheur ne doivent pas être appelables par l'API
revoke execute on function public.audit_row() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 3. Purge de la corbeille et test de membre : uniquement pour les comptes connectés
--    (purge_trash vérifie en plus que l'appelant est un membre actif)
revoke execute on function public.purge_trash(integer) from public, anon;
grant execute on function public.purge_trash(integer) to authenticated;
revoke execute on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

-- purge_trash : refuser tout appel sans compte membre (le cron tourne sans JWT, en tant que postgres)
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
  -- session_user (et non current_user, qui vaut le propriétaire dans une fonction security definer) :
  -- « authenticator » pour un appel via l'API, « postgres » pour la tâche planifiée.
  if session_user not in ('postgres', 'supabase_admin') and not public.is_member() then
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
