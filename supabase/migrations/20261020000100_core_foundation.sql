-- New-install baseline derived from backend queries. Review existing remote schema
-- before applying. Existing tables are preserved; missing columns require a reviewed
-- reconciliation migration, not DROP/CREATE.
begin;
create table if not exists public.secrets (
  id uuid primary key default gen_random_uuid(),
  encrypted_content text not null,
  iv text not null,
  password_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  access_start timestamptz,
  access_end timestamptz,
  max_views integer check (max_views > 0),
  view_count integer not null default 0 check (view_count >= 0),
  burn_after_read boolean not null default false,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  cooldown_until timestamptz,
  status text not null default 'active' check (status in ('active','expired','destroyed','revoked','suspended')),
  destroyed_at timestamptz,
  check (access_end is null or access_start is null or access_end > access_start)
);
create table if not exists public.access_events (
  id uuid primary key default gen_random_uuid(),
  secret_id uuid not null references public.secrets(id) on delete cascade,
  event_type text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.secret_attachments (
  id uuid primary key default gen_random_uuid(),
  secret_id uuid not null references public.secrets(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0 and file_size <= 26214816),
  storage_path text not null unique,
  encrypted_key_bundle text,
  created_at timestamptz not null default now()
);
alter table public.secret_attachments add column if not exists encrypted_key_bundle text;
create table if not exists public.secret_access_tokens (
  token text primary key,
  secret_id uuid not null references public.secrets(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists access_events_secret_created_idx on public.access_events(secret_id,created_at desc);
create index if not exists secrets_expiry_idx on public.secrets(expires_at) where status = 'active';
create index if not exists attachments_secret_idx on public.secret_attachments(secret_id);
create index if not exists access_tokens_expiry_idx on public.secret_access_tokens(expires_at);
alter table public.secrets enable row level security;
alter table public.access_events enable row level security;
alter table public.secret_attachments enable row level security;
alter table public.secret_access_tokens enable row level security;
-- Anonymous sharing goes through backend policy checks. No browser data-table
-- access is granted, including for authenticated users, until ownership exists.
revoke all on public.secrets, public.access_events, public.secret_attachments, public.secret_access_tokens from public, anon, authenticated;
grant select, insert, update, delete on public.secrets, public.access_events, public.secret_attachments, public.secret_access_tokens to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('secure-attachments','secure-attachments',false,26214400,array['application/octet-stream','text/plain'])
on conflict (id) do nothing;
-- Refuse to silently retain a public existing bucket.
do $$ begin
  if exists (select 1 from storage.buckets where id='secure-attachments' and public) then
    raise exception 'Existing secure-attachments bucket is public; review before migration';
  end if;
end $$;
-- No storage.objects policy: only trusted backend service credentials can access.
commit;
