-- Accueil des personnes invitées : tant qu'elles n'ont pas choisi leur mot de passe,
-- l'appli les envoie sur la page de bienvenue.
alter table public.members add column if not exists password_set boolean not null default false;
alter table public.members add column if not exists invited_by text;

-- Les comptes qui se sont déjà connectés avec un mot de passe (premier compte) sont à jour.
update public.members m
set password_set = true
from auth.users u
where u.id = m.id and u.invited_at is null;

-- Le premier compte, créé depuis le tableau de bord avec un mot de passe, n'a pas d'étape d'accueil.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first boolean := not exists (select 1 from public.members);
begin
  insert into public.members (id, email, full_name, active, password_set, invited_by)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    v_first or new.invited_at is not null,
    v_first,
    new.raw_user_meta_data ->> 'invited_by'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Certaines versions du service d'authentification renseignent invited_at juste après la création :
-- on active aussi le membre à ce moment-là.
create or replace function public.handle_user_invited()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.invited_at is not null and old.invited_at is null then
    update public.members
    set active = true,
        invited_by = coalesce(invited_by, new.raw_user_meta_data ->> 'invited_by')
    where id = new.id and password_set = false;
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_user_invited() from public, anon, authenticated;

drop trigger if exists on_auth_user_invited on auth.users;
create trigger on_auth_user_invited
  after update of invited_at on auth.users
  for each row execute function public.handle_user_invited();
