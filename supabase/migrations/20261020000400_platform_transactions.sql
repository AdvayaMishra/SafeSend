create table if not exists public.api_usage (
  id bigint generated always as identity primary key,
  api_key_id uuid references public.api_keys(id) on delete cascade,
  route text not null, created_at timestamptz not null default now()
);
alter table public.api_usage enable row level security;
revoke all on public.api_usage from public,anon,authenticated;
grant select,insert on public.api_usage to service_role;
grant usage on sequence public.api_usage_id_seq to service_role;
create table if not exists secureshare_private.rate_windows (
  key text not null, window_start timestamptz not null, counter integer not null,
  primary key(key,window_start)
);
create or replace function public.take_rate_limit(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer; w timestamptz; begin
  if p_limit<1 or p_seconds<1 then return false; end if;
  w:=to_timestamp(floor(extract(epoch from clock_timestamp())/p_seconds)*p_seconds);
  insert into secureshare_private.rate_windows(key,window_start,counter) values(p_key,w,1)
    on conflict(key,window_start) do update set counter=rate_windows.counter+1 returning counter into n;
  return n<=p_limit;
end $$;
create or replace function public.create_workspace(p_user uuid,p_name text,p_slug text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare wid uuid; begin
  insert into public.workspaces(name,slug,owner_id) values(p_name,p_slug,p_user) returning id into wid;
  insert into public.workspace_members(workspace_id,user_id,role) values(wid,p_user,'owner');
  return wid;
end $$;
create or replace function public.accept_workspace_invitation(p_hash text,p_user uuid,p_email text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare inv public.workspace_invitations%rowtype; begin
  select * into inv from public.workspace_invitations where token_hash=p_hash for update;
  if not found or inv.status<>'pending' or inv.expires_at<=now() or lower(inv.email)<>lower(p_email) then
    raise exception 'Invitation invalid' using errcode='42501'; end if;
  insert into public.workspace_members(workspace_id,user_id,role) values(inv.workspace_id,p_user,inv.role)
    on conflict(workspace_id,user_id) do nothing;
  update public.workspace_invitations set status='accepted' where id=inv.id;
  return inv.workspace_id;
end $$;
revoke all on function public.take_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.create_workspace(uuid,text,text) from public,anon,authenticated;
revoke all on function public.accept_workspace_invitation(text,uuid,text) from public,anon,authenticated;
grant execute on function public.take_rate_limit(text,integer,integer) to service_role;
grant execute on function public.create_workspace(uuid,text,text) to service_role;
grant execute on function public.accept_workspace_invitation(text,uuid,text) to service_role;
create index if not exists api_usage_key_created_idx on public.api_usage(api_key_id,created_at);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
