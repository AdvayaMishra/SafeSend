-- Preserve original rule thresholds. Deactivate only duplicate defaults introduced
-- by migration 006 when an equivalent legacy rule already exists.
update public.threat_rules r set is_active=false
where (r.rule_type,r.name) in (
 ('failed_password','Repeated password failures'),('access_frequency','Excessive access frequency'),
 ('multi_secret','Multiple targeted secrets'),('expired_access','Expired secret probing'),
 ('attachment_abuse','Abnormal attachment requests')) and exists(
 select 1 from public.threat_rules old where old.rule_type=case r.rule_type
 when 'failed_password' then 'FAILED_PASSWORD_THRESHOLD' when 'access_frequency' then 'ACCESS_FREQUENCY'
 when 'multi_secret' then 'CROSS_SECRET_SPRAY' when 'expired_access' then 'EXPIRED_ACCESS_ATTEMPT'
 when 'attachment_abuse' then 'ANOMALOUS_ATTACHMENT_RATE' end);

create or replace function public.observe_security_event(p_secret uuid,p_source text,p_event text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; n integer; wid uuid; uid uuid; kind text; rule_kind text; begin
  perform pg_advisory_xact_lock(hashtext('source:'||p_source));
  if exists(select 1 from secureshare_private.source_defenses where source_hash=p_source and expires_at>now()) then return false; end if;
  select workspace_id,created_by_user_id into wid,uid from public.secrets where id=p_secret;
  if not found then return true; end if;
  insert into public.access_events(secret_id,event_type,ip_address) values(p_secret,'SECURITY_'||p_event,p_source);
  for r in select * from public.threat_rules where is_active loop
    rule_kind:=case r.rule_type when 'FAILED_PASSWORD_THRESHOLD' then 'failed_password'
      when 'ACCESS_FREQUENCY' then 'access_frequency' when 'CROSS_SECRET_SPRAY' then 'multi_secret'
      when 'EXPIRED_ACCESS_ATTEMPT' then 'expired_access' when 'ANOMALOUS_ATTACHMENT_RATE' then 'attachment_abuse'
      else r.rule_type end;
    kind:=case rule_kind when 'failed_password' then 'SECURITY_FAILED_PASSWORD'
      when 'policy_violation' then 'SECURITY_POLICY_DENIED' when 'expired_access' then 'SECURITY_EXPIRED_ACCESS'
      when 'attachment_abuse' then 'SECURITY_ATTACHMENT_REJECTED'
      when 'access_frequency' then 'SECURITY_ACCESS_ATTEMPT' when 'multi_secret' then 'SECURITY_ACCESS_ATTEMPT' else null end;
    -- Unknown rule types do not silently become access-frequency rules.
    if kind is null or r.threshold<1 or r.window_seconds<1 or r.window_seconds>86400 then continue; end if;
    if 'SECURITY_'||p_event<>kind then continue; end if;
    if rule_kind='multi_secret' then
      select count(distinct secret_id) into n from public.access_events where ip_address=p_source
        and event_type=kind and created_at>=now()-make_interval(secs=>r.window_seconds);
    else
      select count(*) into n from public.access_events where ip_address=p_source
        and event_type=kind and created_at>=now()-make_interval(secs=>r.window_seconds);
    end if;
    if n>=r.threshold and not exists(select 1 from public.threat_incidents where source_ip=p_source
      and incident_type=rule_kind and created_at>now()-make_interval(secs=>r.window_seconds)) then
      insert into public.threat_incidents(incident_type,severity,risk_score,source_ip,target_secret_id,
        target_workspace_id,description,details,status,defensive_action)
      values(rule_kind,r.severity,r.risk_score,p_source,p_secret,wid,r.description,
        jsonb_build_object('observations',n,'threshold',r.threshold,'windowSeconds',r.window_seconds),
        'open',case when r.risk_score>=50 then 'Temporary source cooldown (10 minutes)' else 'Alert recorded' end);
      if r.risk_score>=50 then insert into secureshare_private.source_defenses(source_hash,expires_at)
        values(p_source,now()+interval '10 minutes') on conflict(source_hash) do update set expires_at=excluded.expires_at; end if;
      if uid is not null and coalesce((select threat_alerts from public.notification_preferences where user_id=uid),true) then
        insert into public.notifications(user_id,workspace_id,type,title,body,metadata)
          values(uid,wid,'THREAT','Suspicious access detected',r.description,jsonb_build_object('secretId',p_secret));
      end if;
    end if;
  end loop;
  return true;
end $$;
