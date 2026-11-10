-- Poste dans le dépôt et avatar des collaborateurs, mot de clôture des remontées,
-- suppression définitive des remontées réservée aux administrateurs.
alter table public.employees add column if not exists zone text;
alter table public.employees add column if not exists avatar jsonb;
alter table public.delivery_notes add column if not exists closure_note text;

alter policy delivery_notes_delete on public.delivery_notes using (public.is_admin());

create or replace function public.protect_closed_note() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and old.status = 'done' and old.deleted_at is null and new.deleted_at is not null and not public.is_admin() then
    raise exception 'Seul un administrateur peut supprimer une remontée archivée';
  end if;
  return new;
end; $$;
revoke execute on function public.protect_closed_note() from public, anon, authenticated;

create or replace trigger delivery_notes_protect before update on public.delivery_notes
  for each row execute function public.protect_closed_note();
