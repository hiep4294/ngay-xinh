-- Ngay Xinh - Supabase schema
-- Run this in Supabase SQL Editor once for the project.

create table if not exists public.entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  title text not null default '',
  note text not null default '',
  mood text not null default '',
  color text not null default '',
  media jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, date),
  constraint entries_mood_check check (mood in ('','happy','calm','grateful','sad','stress')),
  constraint entries_color_check check (color = '' or color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint entries_media_array_check check (jsonb_typeof(media) = 'array')
);

alter table public.entries enable row level security;

revoke all on table public.entries from anon, authenticated;
grant select, insert, update, delete on table public.entries to authenticated;

drop policy if exists "entries_select_own" on public.entries;
create policy "entries_select_own"
on public.entries
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "entries_insert_own" on public.entries;
create policy "entries_insert_own"
on public.entries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "entries_update_own" on public.entries;
create policy "entries_update_own"
on public.entries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "entries_delete_own" on public.entries;
create policy "entries_delete_own"
on public.entries
for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('journal-media', 'journal-media', false, 104857600)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "journal_media_select_own" on storage.objects;
create policy "journal_media_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'journal-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "journal_media_insert_own" on storage.objects;
create policy "journal_media_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'journal-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "journal_media_update_own" on storage.objects;
create policy "journal_media_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'journal-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'journal-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "journal_media_delete_own" on storage.objects;
create policy "journal_media_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'journal-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'entries'
  ) then
    alter publication supabase_realtime add table public.entries;
  end if;
end $$;
