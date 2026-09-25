-- Run once in the SQL Editor of YOUR Supabase project, before enabling accounts.
begin;
create table if not exists public.diary_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  title text not null default '' check (length(title) <= 120),
  note text not null default '',
  mood text not null default '' check (mood in ('','happy','calm','grateful','sad','stress')),
  color text not null default '' check (color = '' or color ~ '^#[0-9A-Fa-f]{6}$'),
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.diary_entries enable row level security;
revoke all on public.diary_entries from anon;
grant select, insert, update, delete on public.diary_entries to authenticated;
create policy "Read own diary" on public.diary_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own diary" on public.diary_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own diary" on public.diary_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own diary" on public.diary_entries for delete to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diary-media', 'diary-media', false, 52428800, array['image/*','video/*'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
create policy "Read own diary media" on storage.objects for select to authenticated
using (bucket_id = 'diary-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Upload own diary media" on storage.objects for insert to authenticated
with check (bucket_id = 'diary-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own diary media" on storage.objects for delete to authenticated
using (bucket_id = 'diary-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
