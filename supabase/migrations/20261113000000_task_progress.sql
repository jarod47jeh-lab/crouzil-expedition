-- =====================================================================
-- To do list : suivi de l'avancement avant clôture.
-- Chaque tâche a un pourcentage d'avancement et un fil de points d'étape
-- (qui, quand, quoi). On ne peut la clôturer qu'avec un mot de clôture.
-- =====================================================================
alter table public.tasks add column if not exists progress integer not null default 0;
alter table public.tasks add column if not exists updates jsonb not null default '[]'::jsonb;
alter table public.tasks add column if not exists closure_note text;
alter table public.tasks drop constraint if exists tasks_progress_range;
alter table public.tasks add constraint tasks_progress_range check (progress between 0 and 100);

-- Les tâches déjà faites gardent leur état : on les considère terminées à 100 %
update public.tasks set progress = 100 where done and progress < 100;

-- Ajouter un point d'étape : texte, nouvel avancement, auteur et date ajoutés côté base.
-- security invoker : les règles d'accès (RLS) de la table s'appliquent.
create or replace function public.add_task_update(p_task uuid, p_text text, p_progress integer)
returns public.tasks
language plpgsql security invoker set search_path = public as $$
declare
  r public.tasks;
  who text;
begin
  if coalesce(trim(p_text), '') = '' then
    raise exception 'Décrivez ce qui a été fait.';
  end if;
  if p_progress is null or p_progress < 0 or p_progress > 100 then
    raise exception 'L''avancement doit être entre 0 et 100 %%.';
  end if;
  select coalesce(nullif(m.full_name, ''), m.email) into who from public.members m where m.id = auth.uid();
  update public.tasks
     set updates = coalesce(updates, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
           'at', now(), 'by', auth.uid(), 'name', who, 'text', left(trim(p_text), 1000), 'progress', p_progress)),
         progress = p_progress
   where id = p_task and deleted_at is null
  returning * into r;
  if r.id is null then
    raise exception 'Tâche introuvable ou modification non autorisée.';
  end if;
  return r;
end;
$$;
revoke execute on function public.add_task_update(uuid, text, integer) from public, anon;
grant execute on function public.add_task_update(uuid, text, integer) to authenticated;

-- Clôture : un mot de clôture est obligatoire, et l'avancement passe à 100 %
create or replace function public.guard_task_close() returns trigger
language plpgsql set search_path = public as $$
declare
  was_done boolean := tg_op = 'UPDATE' and old.done;
begin
  if new.done and not was_done then
    if coalesce(trim(new.closure_note), '') = '' then
      raise exception 'Pour clôturer, indiquez comment la tâche a été menée à bien.';
    end if;
    new.progress := 100;
  elsif not new.done and was_done then
    -- tâche rouverte : on garde le mot de clôture dans le fil, on repart de l'avancement précédent
    new.progress := least(coalesce(new.progress, 0), 90);
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_task_close() from public, anon, authenticated;
drop trigger if exists tasks_guard_close on public.tasks;
create trigger tasks_guard_close before insert or update on public.tasks
  for each row execute function public.guard_task_close();
