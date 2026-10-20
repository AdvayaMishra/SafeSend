create or replace function public.audit_workspace_change() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; wid uuid; action_name text; begin
  item:=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  wid:=case when TG_TABLE_NAME='workspaces' then (item->>'id')::uuid else (item->>'workspace_id')::uuid end;
  action_name:=case TG_TABLE_NAME when 'workspaces' then 'WORKSPACE_' when 'workspace_members' then 'MEMBERSHIP_' else 'INVITATION_' end||TG_OP;
  perform public.append_audit_event('workspace:'||wid,'backend',action_name,'workspace',wid::text,wid,
    jsonb_strip_nulls(jsonb_build_object('recordId',item->>'id','role',item->>'role')));
  if TG_OP='DELETE' then return OLD; end if;return NEW;
end $$;
create trigger secure_share_workspace_audit after insert or update on public.workspaces
  for each row execute function public.audit_workspace_change();
create trigger secure_share_membership_audit after insert or update or delete on public.workspace_members
  for each row execute function public.audit_workspace_change();
create trigger secure_share_invitation_audit after insert or update on public.workspace_invitations
  for each row execute function public.audit_workspace_change();
revoke all on function public.audit_workspace_change() from public,anon,authenticated;
