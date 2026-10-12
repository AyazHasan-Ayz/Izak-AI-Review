begin;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  logo_url text not null default '' check (logo_url = '' or logo_url like 'https://%'),
  logo_path text,
  google_review_url text not null check (google_review_url like 'https://%'),
  category text not null check (char_length(category) between 1 and 100),
  city text not null check (char_length(city) between 1 and 100),
  seo_keywords jsonb not null default '[]' check (jsonb_typeof(seo_keywords) = 'array' and jsonb_array_length(seo_keywords) <= 20),
  daily_limit integer not null default 100 check (daily_limit between 1 and 10000),
  status text not null default 'inactive' check (status in ('active','inactive')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  token_encrypted text not null,
  review_settings jsonb not null default '{}' check (jsonb_typeof(review_settings) = 'object'),
  created_at timestamptz not null default now(),
  constraint active_business_has_logo check (status <> 'active' or logo_url <> '')
);
create index businesses_status_name_idx on public.businesses(status, name);

-- Service-only counters: no raw IPs, feedback, ratings or drafts.
create table public.usage_buckets (
  key text primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  count integer not null check (count >= 0),
  expires_at timestamptz not null
);
create index usage_buckets_expiry_idx on public.usage_buckets(expires_at);
create index usage_buckets_business_idx on public.usage_buckets(business_id);
alter table public.businesses enable row level security;
alter table public.usage_buckets enable row level security;
-- Deliberately no browser policies: all requests pass the server's getUser + UUID guard.
revoke all on public.businesses, public.usage_buckets from public, anon, authenticated;
grant all on public.businesses, public.usage_buckets to service_role;

create function public.reserve_generation(p_token_hash text, p_ip text, p_session text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  b public.businesses%rowtype;
  stamp timestamptz := clock_timestamp();
  day_key text := to_char(stamp at time zone 'UTC','YYYY-MM-DD');
  minute_key text := to_char(stamp at time zone 'UTC','YYYY-MM-DD-HH24-MI');
  keys text[];
  caps integer[];
  i integer;
  used integer;
begin
  if p_ip is null or p_session is null or p_ip !~ '^[a-f0-9]{64}$' or p_session !~ '^[a-f0-9]{64}$' then return 'limited'; end if;
  -- Serialize reservations, including global/IP buckets shared by different businesses.
  perform pg_advisory_xact_lock(492018217);
  select * into b from public.businesses where token_hash = p_token_hash for update;
  if not found or b.status <> 'active' then return 'unavailable'; end if;
  delete from public.usage_buckets where expires_at < stamp;
  keys := array['global:'||day_key, 'business:'||b.id||':'||day_key,
    'ip:'||p_ip||':'||day_key, 'session:'||p_session||':'||day_key,
    'ip-minute:'||p_ip||':'||minute_key, 'business-minute:'||b.id||':'||minute_key];
  caps := array[2000,b.daily_limit,30,10,5,30];
  for i in 1..array_length(keys,1) loop
    select count into used from public.usage_buckets where key = keys[i];
    if coalesce(used,0) >= caps[i] then return 'limited'; end if;
  end loop;
  for i in 1..array_length(keys,1) loop
    insert into public.usage_buckets(key,business_id,count,expires_at)
    values(keys[i],case when i in (2,6) then b.id else null end,1,
      case when i >= 5 then stamp + interval '2 minutes' else (date_trunc('day',stamp at time zone 'UTC') at time zone 'UTC') + interval '1 day' end)
    on conflict(key) do update set count = public.usage_buckets.count + 1;
  end loop;
  return 'ok';
end;
$$;
revoke all on function public.reserve_generation(text,text,text) from public, anon, authenticated;
grant execute on function public.reserve_generation(text,text,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('business-logos','business-logos',true,2097152,array['image/webp'])
on conflict(id) do nothing;
-- No storage write policies for anon/authenticated. Only the authorized backend uploads.
commit;
