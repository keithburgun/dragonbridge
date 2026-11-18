-- Dragon Bridge account sync: run this once in the Supabase project the game points at
-- (Dashboard → SQL Editor → New query → paste → Run). It is safe to run again.
--
-- Dragon Bridge has its own Supabase project ("dragonbridge"). This creates its table:
-- one private row of save data per account.

create table if not exists public.dragonbridge_saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.dragonbridge_saves enable row level security;

-- Each signed-in player can read and write only their own row.
drop policy if exists "dragonbridge_saves: own row" on public.dragonbridge_saves;
create policy "dragonbridge_saves: own row" on public.dragonbridge_saves
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.dragonbridge_saves to authenticated;
