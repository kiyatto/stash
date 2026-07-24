-- Share link expiry + stash cover image override.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.stashes
  add column if not exists share_expires_at timestamptz,
  add column if not exists cover_image_path text;

-- ---------------------------------------------------------------------------
-- Share lookup RPCs — honour expiry (null = never expires)
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
    and (s.share_expires_at is null or s.share_expires_at > now())
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
    and (s.share_expires_at is null or s.share_expires_at > now())
  order by i.created_at asc;
$$;
