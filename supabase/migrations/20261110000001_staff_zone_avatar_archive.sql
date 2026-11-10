-- =====================================================================
-- Personnel dans le dépôt 3D, avatars, archivage des remontées.
-- =====================================================================

-- Zone d'affectation (où le collaborateur travaille dans le dépôt) et avatar personnalisé
alter table public.employees add column if not exists zone text;
alter table public.employees add column if not exists avatar jsonb;

-- Remontées : un mot de clôture, gardé avec la remontée archivée
alter table public.delivery_notes add column if not exists closure_note text;

-- Seul un administrateur supprime définitivement une remontée
drop policy if exists delivery_notes_delete on public.delivery_notes;
create policy delivery_notes_delete on public.delivery_notes for delete to authenticated using (public.is_admin());

-- Une remontée close est une archive : seul un administrateur peut la mettre à la corbeille
create or replace function public.protect_closed_note()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and old.status = 'done' and old.deleted_at is null and new.deleted_at is not null and not public.is_admin() then
    raise exception 'Seul un administrateur peut supprimer une remontée archivée';
  end if;
  return new;
end;
$$;
revoke execute on function public.protect_closed_note() from public, anon, authenticated;
drop trigger if exists delivery_notes_protect on public.delivery_notes;
create trigger delivery_notes_protect before update on public.delivery_notes
  for each row execute function public.protect_closed_note();
