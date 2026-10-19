insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'scores',
  'scores',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Score files are readable by their owner" on storage.objects;
create policy "Score files are readable by their owner"
on storage.objects for select
to authenticated
using (
  bucket_id = 'scores'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can upload their own score files" on storage.objects;
create policy "Users can upload their own score files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'scores'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can update their own score files" on storage.objects;
create policy "Users can update their own score files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'scores'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'scores'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can delete their own score files" on storage.objects;
create policy "Users can delete their own score files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'scores'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
