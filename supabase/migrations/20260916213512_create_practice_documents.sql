create table public.practice_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"categories":[],"state":{"pieces":{},"collapsed":{}}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practice_documents_payload_is_object check (jsonb_typeof(payload) = 'object'),
  constraint practice_documents_payload_size check (octet_length(payload::text) <= 2097152)
);

comment on table public.practice_documents is
  'One private classical-guitar practice document per authenticated user.';

alter table public.practice_documents enable row level security;
alter table public.practice_documents force row level security;

revoke all on table public.practice_documents from anon, authenticated;
grant select, insert, update, delete on table public.practice_documents to authenticated;

create policy "Users can read their own practice document"
on public.practice_documents for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own practice document"
on public.practice_documents for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own practice document"
on public.practice_documents for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own practice document"
on public.practice_documents for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.set_practice_document_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_practice_document_updated_at() from public, anon, authenticated;

create trigger set_practice_document_updated_at
before update on public.practice_documents
for each row execute function public.set_practice_document_updated_at();
