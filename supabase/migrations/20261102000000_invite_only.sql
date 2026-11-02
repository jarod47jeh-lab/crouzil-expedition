-- Verrou « sur invitation uniquement », même si les inscriptions publiques
-- restent ouvertes dans les réglages Supabase :
--   - le tout premier compte (créé depuis le tableau de bord) devient membre actif ;
--   - ensuite, seuls les comptes invités (invited_at renseigné) sont actifs ;
--   - un compte créé autrement est enregistré mais désactivé, donc sans aucun accès.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first boolean := not exists (select 1 from public.members);
begin
  insert into public.members (id, email, full_name, active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    v_first or new.invited_at is not null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
