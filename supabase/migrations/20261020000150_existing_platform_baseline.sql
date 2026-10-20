-- Fresh-project bootstrap matching the inspected development schema. This file
-- is NOT applied over the existing project; subsequent migrations reconcile it.
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),email text not null unique,
  display_name text,password_hash text,is_email_verified boolean not null default false,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),name text not null,slug text not null unique,
  owner_id uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role text not null check(role in ('owner','admin','member','auditor')),created_at timestamptz not null default now(),unique(workspace_id,user_id)
);
create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,role text not null check(role in ('admin','member','auditor')),token_hash text not null unique,
  invited_by uuid not null references public.user_profiles(id) on delete cascade,expires_at timestamptz not null,
  status text not null default 'pending',created_at timestamptz not null default now()
);
alter table public.secrets add column if not exists recipient_email text;
alter table public.secrets add column if not exists recipient_verified boolean not null default false;
alter table public.secrets add column if not exists is_suspended boolean not null default false;
alter table public.secrets add column if not exists suspension_reason text;
alter table public.secrets add column if not exists policy_preset text;
alter table public.secrets add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.secrets add column if not exists created_by_user_id uuid references public.user_profiles(id) on delete set null;
alter table public.access_events add column if not exists ip_address text;
alter table public.access_events add column if not exists user_agent text;
create table if not exists public.secret_events (
  id uuid primary key default gen_random_uuid(),secret_id uuid not null references public.secrets(id) on delete cascade,
  event_type text not null,event_detail text,ip_address text,created_at timestamptz not null default now()
);
create table if not exists public.threat_rules (
  id uuid primary key default gen_random_uuid(),name text not null,description text,rule_type text not null,
  threshold integer not null,window_seconds integer not null,risk_score integer not null,
  severity text not null check(severity in ('LOW','MEDIUM','HIGH','CRITICAL')),is_active boolean not null default true,created_at timestamptz not null default now()
);
create table if not exists public.threat_incidents (
  id uuid primary key default gen_random_uuid(),incident_type text not null,severity text not null check(severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  risk_score integer not null,source_ip text,user_agent text,target_secret_id uuid references public.secrets(id) on delete set null,
  target_workspace_id uuid references public.workspaces(id) on delete set null,description text not null,details jsonb not null default '{}',
  status text not null default 'open' check(status in ('open','investigating','resolved','dismissed')),
  defensive_action text,created_at timestamptz not null default now(),resolved_at timestamptz
);
create table if not exists public.tamper_audit_logs (
  sequence_number bigserial primary key,event_id uuid not null default gen_random_uuid(),timestamp timestamptz not null default now(),
  workspace_id uuid references public.workspaces(id) on delete set null,actor_id text not null,action text not null,
  resource_type text not null,resource_id text not null,metadata jsonb not null default '{}',
  canonical_payload text not null,previous_hash text not null,current_hash text not null,created_at timestamptz not null default now()
);
create table if not exists public.recipient_access_tokens (
  id uuid primary key default gen_random_uuid(),secret_id uuid not null references public.secrets(id) on delete cascade,
  recipient_email text not null,verification_token_hash text not null unique,expires_at timestamptz not null,
  is_used boolean not null default false,used_at timestamptz,created_at timestamptz not null default now()
);
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,name text not null,key_prefix text not null,key_hash text not null unique,
  scopes text[] not null,rate_limit_per_minute integer not null default 60,expires_at timestamptz,last_used_at timestamptz,
  is_revoked boolean not null default false,created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references public.user_profiles(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,type text not null,title text not null,body text not null,
  metadata jsonb not null default '{}',is_read boolean not null default false,read_at timestamptz,created_at timestamptz not null default now()
);
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,threat_alerts boolean not null default true,
  access_notifications boolean not null default true,expiration_notices boolean not null default true,email_delivery boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.user_passkeys (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references public.user_profiles(id) on delete cascade,
  credential_id text not null unique,public_key text not null,counter bigint not null default 0,transports text[],device_name text,
  created_at timestamptz not null default now(),last_used_at timestamptz
);
create table if not exists public.passkey_challenges (
  id uuid primary key default gen_random_uuid(),user_id uuid references public.user_profiles(id) on delete cascade,challenge text not null,
  type text not null check(type in ('registration','authentication')),expires_at timestamptz not null,created_at timestamptz not null default now()
);
create table if not exists public.upload_sessions (
  id uuid primary key default gen_random_uuid(),secret_id uuid not null references public.secrets(id) on delete cascade,
  file_name text not null,mime_type text not null,total_file_size bigint not null,chunk_size integer not null,total_chunks integer not null,
  uploaded_chunks integer not null default 0,storage_path text not null,encrypted_key_bundle text,
  status text not null default 'in_progress' check(status in ('in_progress','completed','aborted','expired')),
  expires_at timestamptz not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.upload_chunks (
  id uuid primary key default gen_random_uuid(),session_id uuid not null references public.upload_sessions(id) on delete cascade,
  chunk_index integer not null,chunk_size integer not null,chunk_hash text not null,uploaded_at timestamptz not null default now(),unique(session_id,chunk_index)
);
-- Recreate the original policies for the bootstrap, then migration 002 restricts
-- their roles. These statements run only during a fresh project bootstrap.
create policy "Allow backend delete from secure-attachments" on storage.objects for delete to service_role using(bucket_id='secure-attachments');
create policy "Allow backend read from secure-attachments" on storage.objects for select to service_role using(bucket_id='secure-attachments');
create policy "Allow backend upload to secure-attachments" on storage.objects for insert to service_role with check(bucket_id='secure-attachments');
do $$ declare t text; begin
  foreach t in array array['user_profiles','workspaces','workspace_members','workspace_invitations','secret_events',
    'threat_rules','threat_incidents','tamper_audit_logs','recipient_access_tokens','api_keys','notifications',
    'notification_preferences','user_passkeys','passkey_challenges','upload_sessions','upload_chunks'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to service_role',t);
  end loop;
end $$;
