-- Photos des réparations (bucket privé, réservé aux membres)
insert into storage.buckets (id, name, public)
values ('repair-photos', 'repair-photos', false)
on conflict (id) do nothing;

create policy repair_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'repair-photos' and public.is_member());
create policy repair_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'repair-photos' and public.is_member());
create policy repair_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'repair-photos' and public.is_member());

