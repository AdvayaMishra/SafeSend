alter table public.secrets add column if not exists management_token_hash text;
alter table public.secret_access_tokens add column if not exists delivery_grant boolean not null default false;
alter table public.secret_access_tokens add column if not exists token_hash text;
create unique index if not exists secret_access_token_hash_idx on public.secret_access_tokens(token_hash) where token_hash is not null;

create or replace function public.consume_secret(p_id uuid, p_password_hash text,
  p_email text, p_token_hash text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.secrets%rowtype; stop boolean; begin
  select * into s from public.secrets where id=p_id for update;
  if not found then return jsonb_build_object('code','NOT_FOUND','status',404); end if;
  if s.status <> 'active' or s.destroyed_at is not null then
    return jsonb_build_object('code','SECRET_DESTROYED','status',410); end if;
  if s.expires_at <= now() then return jsonb_build_object('code','SECRET_EXPIRED','status',410); end if;
  if s.is_suspended then return jsonb_build_object('code','ACCESS_SUSPENDED','status',403); end if;
  if s.access_start > now() then return jsonb_build_object('code','ACCESS_WINDOW_NOT_STARTED','status',403); end if;
  if s.access_end <= now() then return jsonb_build_object('code','ACCESS_WINDOW_ENDED','status',403); end if;
  if s.cooldown_until > now() then return jsonb_build_object('code','RATE_LIMITED','status',429); end if;
  if s.max_views is not null and s.view_count >= s.max_views then
    return jsonb_build_object('code','MAX_VIEWS_REACHED','status',410); end if;
  if s.recipient_email is not null and lower(s.recipient_email) is distinct from lower(p_email) then
    return jsonb_build_object('code','RECIPIENT_REQUIRED','status',403); end if;
  if s.password_hash is distinct from p_password_hash then
    return jsonb_build_object('code','PASSWORD_REQUIRED','status',401); end if;
  stop := s.burn_after_read or (s.max_views is not null and s.view_count+1 >= s.max_views);
  update public.secrets set view_count=view_count+1, failed_attempts=0, cooldown_until=null,
    status=case when stop then 'destroyed' else status end,
    destroyed_at=case when stop then now() else destroyed_at end where id=p_id;
  -- Store only token digest. The token column is retained for legacy compatibility.
  insert into public.secret_access_tokens(token,token_hash,secret_id,expires_at,delivery_grant)
    values(p_token_hash,p_token_hash,p_id,least(now()+interval '10 minutes',s.expires_at),true);
  insert into public.access_events(secret_id,event_type) values(p_id,'ACCESS_SUCCESS');
  if stop then insert into public.access_events(secret_id,event_type) values(p_id,'MESSAGE_DESTROYED'); end if;
  return jsonb_build_object('success',true,'encryptedContent',s.encrypted_content,'iv',s.iv,
    'destroyedAfterAccess',stop,'viewsRemaining',case when s.max_views is null then null
      else greatest(s.max_views-s.view_count-1,0) end);
end $$;

create or replace function public.record_password_failure(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.secrets%rowtype; attempts integer; cooldown timestamptz; begin
  select * into s from public.secrets where id=p_id for update;
  if not found then return jsonb_build_object('status',404); end if;
  if s.cooldown_until > now() then return jsonb_build_object('status',429,'cooldownUntil',s.cooldown_until); end if;
  attempts := least(s.failed_attempts+1,1000000);
  cooldown := case when attempts%3=0 then now()+make_interval(mins=>least(405,15*power(3,least(attempts/3-1,3))::integer)) else null end;
  update public.secrets set failed_attempts=attempts,cooldown_until=cooldown where id=p_id;
  insert into public.access_events(secret_id,event_type) values(p_id,'FAILED_PASSWORD');
  if cooldown is not null then insert into public.access_events(secret_id,event_type) values(p_id,'COOLDOWN_STARTED'); end if;
  return jsonb_build_object('status',401,'failedAttempts',attempts,'cooldownUntil',cooldown);
end $$;
revoke all on function public.consume_secret(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.record_password_failure(uuid) from public,anon,authenticated;
grant execute on function public.consume_secret(uuid,text,text,text) to service_role;
grant execute on function public.record_password_failure(uuid) to service_role;
