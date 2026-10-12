-- ==============================================================================
-- YouDO — User Push Tokens (Firebase Cloud Messaging)
-- ==============================================================================
-- Stores FCM device registration tokens for mobile push notifications.
-- Each authenticated user can have one or more registered device tokens.
-- Tokens are upserted from the mobile client on app start / login.
-- ==============================================================================

-- 1. Create the user_push_tokens table
create table if not exists public.user_push_tokens (
  user_id uuid references auth.users(id) on delete cascade not null,
  token text not null,
  platform text default 'android',
  updated_at timestamptz default now(),
  primary key (user_id, token)
);

-- 2. Enable Row Level Security (RLS)
alter table public.user_push_tokens enable row level security;

-- 3. Policy: Users can insert, update, and delete their own device tokens
drop policy if exists "Users can manage their own push tokens" on public.user_push_tokens;
create policy "Users can manage their own push tokens"
  on public.user_push_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Index for fast lookup by user_id
create index if not exists idx_user_push_tokens_user on public.user_push_tokens(user_id);

-- 5. Helper function for housekeeping: remove stale tokens not updated in 90 days
create or replace function public.cleanup_stale_push_tokens()
returns void
language sql
security definer
as $$
  delete from public.user_push_tokens
  where updated_at < now() - interval '90 days';
$$;
