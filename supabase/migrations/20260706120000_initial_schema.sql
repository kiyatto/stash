-- Stash Phase 1: profiles, stashes, stash_items, RLS, storage buckets.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  avatar_seed text not null default gen_random_uuid()::text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, avatar_seed)
  values (new.id, gen_random_uuid()::text);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- stashes
-- ---------------------------------------------------------------------------

create table public.stashes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My Stash',
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stashes_name_length check (char_length(name) between 1 and 120)
);

create index stashes_owner_id_idx on public.stashes (owner_id);
create unique index stashes_share_token_idx
  on public.stashes (share_token)
  where share_token is not null;

create trigger stashes_set_updated_at
  before update on public.stashes
  for each row execute function public.set_updated_at();

create or replace function public.enforce_stash_limit()
returns trigger
language plpgsql
as $$
declare
  stash_count integer;
begin
  select count(*)::integer
  into stash_count
  from public.stashes
  where owner_id = new.owner_id;

  if stash_count >= 10 then
    raise exception 'stash limit reached (10)';
  end if;

  return new;
end;
$$;

create trigger stashes_enforce_limit
  before insert on public.stashes
  for each row execute function public.enforce_stash_limit();

-- ---------------------------------------------------------------------------
-- stash_items
-- ---------------------------------------------------------------------------

create table public.stash_items (
  id uuid primary key default gen_random_uuid(),
  stash_id uuid not null references public.stashes (id) on delete cascade,
  name text not null default '',
  image_path text,
  link text,
  notes text,
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null default 220,
  height double precision not null default 260,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stash_items_stash_id_idx on public.stash_items (stash_id);

create trigger stash_items_set_updated_at
  before update on public.stash_items
  for each row execute function public.set_updated_at();

create or replace function public.enforce_item_limit()
returns trigger
language plpgsql
as $$
declare
  item_count integer;
begin
  select count(*)::integer
  into item_count
  from public.stash_items
  where stash_id = new.stash_id;

  if item_count >= 50 then
    raise exception 'stash item limit reached (50)';
  end if;

  return new;
end;
$$;

create trigger stash_items_enforce_limit
  before insert on public.stash_items
  for each row execute function public.enforce_item_limit();

-- ---------------------------------------------------------------------------
-- Share lookup (public read by token — no table-wide leak)
-- ---------------------------------------------------------------------------

create or replace function public.get_stash_by_share_token(token text)
returns table (
  id uuid,
  name text,
  share_token text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name, s.share_token, s.created_at, s.updated_at
  from public.stashes s
  where s.share_token = token
  limit 1;
$$;

create or replace function public.get_stash_items_by_share_token(token text)
returns setof public.stash_items
language sql
stable
security definer
set search_path = public
as $$
  select i.*
  from public.stash_items i
  inner join public.stashes s on s.id = i.stash_id
  where s.share_token = token
  order by i.created_at asc;
$$;

grant execute on function public.get_stash_by_share_token(text) to anon, authenticated;
grant execute on function public.get_stash_items_by_share_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.stashes enable row level security;
alter table public.stash_items enable row level security;

-- profiles: users manage their own row
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- stashes: owners have full access
create policy "stashes_select_own"
  on public.stashes for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "stashes_insert_own"
  on public.stashes for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "stashes_update_own"
  on public.stashes for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "stashes_delete_own"
  on public.stashes for delete
  to authenticated
  using (auth.uid() = owner_id);

-- stash_items: access via stash ownership
create policy "stash_items_select_own"
  on public.stash_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.stashes s
      where s.id = stash_items.stash_id
        and s.owner_id = auth.uid()
    )
  );

create policy "stash_items_insert_own"
  on public.stash_items for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.stashes s
      where s.id = stash_items.stash_id
        and s.owner_id = auth.uid()
    )
  );

create policy "stash_items_update_own"
  on public.stash_items for update
  to authenticated
  using (
    exists (
      select 1
      from public.stashes s
      where s.id = stash_items.stash_id
        and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.stashes s
      where s.id = stash_items.stash_id
        and s.owner_id = auth.uid()
    )
  );

create policy "stash_items_delete_own"
  on public.stash_items for delete
  to authenticated
  using (
    exists (
      select 1
      from public.stashes s
      where s.id = stash_items.stash_id
        and s.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'stash-images',
    'stash-images',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
on conflict (id) do nothing;

-- Avatars: users read all (public bucket), write only their folder
create policy "avatars_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Stash images: public read, owners write under {user_id}/{stash_id}/*
create policy "stash_images_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'stash-images');

create policy "stash_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'stash-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "stash_images_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'stash-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "stash_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'stash-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
