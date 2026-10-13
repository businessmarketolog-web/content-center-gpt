-- Bounded Content Center AI generation quota. No client or content_items changes.
-- User can never view or write counter rows; only the scoped RPC can reserve.
create table if not exists public.content_ai_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  utc_day date not null,
  requests integer not null default 0 check (requests between 0 and 8),
  last_request_at timestamptz not null default now(),
  primary key (user_id, utc_day)
);
alter table public.content_ai_quota enable row level security;
revoke all on table public.content_ai_quota from public, anon, authenticated;
-- service_role retains operational visibility for audits; users use only the RPC.

create or replace function public.reserve_content_ai_quota()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_counter integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- Atomic upsert takes the primary-key row lock; concurrent requests count once each.
  -- Limit: eight generation ATTEMPTS in one UTC day, at least 30 sec apart.
  insert into public.content_ai_quota(user_id,utc_day,requests,last_request_at)
  values (v_uid,(now() at time zone 'UTC')::date,1,now())
  on conflict (user_id,utc_day) do update
  set requests=public.content_ai_quota.requests+1,last_request_at=now()
  where public.content_ai_quota.requests<8
    and public.content_ai_quota.last_request_at <= now()-interval '30 seconds'
  returning requests into v_counter;
  if v_counter is null then
    return -1;
  end if;
  return 8-v_counter;
end
$$;
revoke all on function public.reserve_content_ai_quota() from public, anon;
grant execute on function public.reserve_content_ai_quota() to authenticated;
