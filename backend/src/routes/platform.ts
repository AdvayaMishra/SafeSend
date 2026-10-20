import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { check,HttpError,identity,profile,token,digest,uuid } from '../security.js';
import crypto from 'node:crypto';
import { readFileSync,appendFileSync,existsSync } from 'node:fs';
const router=Router();
async function user(req:any) {const u=(await identity(req,true))!;await profile(u);return u;}
async function current(req:any) {
  const u=await user(req),selected=req.get('x-workspace-id');
  let q=supabase.from('workspace_members').select('id,workspace_id,role').eq('user_id',u.id).order('created_at').limit(1);
  if(selected) {if(!uuid(selected))throw new HttpError(400,'INVALID_WORKSPACE');q=q.eq('workspace_id',selected);}
  const member=check(await q.maybeSingle());if(!member)throw new HttpError(404,'WORKSPACE_REQUIRED','Create a workspace to get started.');
  return {u,member};
}
export async function visibleSecretIds(userId:string) {
  const memberships=check(await supabase.from('workspace_members').select('workspace_id').eq('user_id',userId))??[];
  const ws=memberships.map(m=>m.workspace_id);
  const result=check(await supabase.from('secrets').select('id').or(`created_by_user_id.eq.${userId}${ws.length?`,workspace_id.in.(${ws.join(',')})`:''}`).limit(1000))??[];
  return result.map(s=>s.id);
}
const roleValid=(r:unknown)=>typeof r==='string'&&['admin','member','auditor'].includes(r);
router.get('/account',async(req,res)=>{const u=await user(req);res.json({id:u.id,email:u.email,verified:u.verified});});
router.get('/workspaces',async(req,res)=>{
  const u=await user(req);const m=check(await supabase.from('workspace_members').select('workspace_id,role,workspaces(id,name)').eq('user_id',u.id));
  res.json({workspaces:m});
});
router.post('/workspaces',async(req,res)=>{
  const u=await user(req);const name=req.body?.name;
  if(typeof name!=='string'||name.trim().length<1||name.length>100)throw new HttpError(400,'INVALID_NAME');
  const id=check(await supabase.rpc('create_workspace',{p_user:u.id,p_name:name.trim(),p_slug:crypto.randomUUID()}));
  res.status(201).json({id});
});
router.get('/workspaces/current',async(req,res)=>{
  const {u,member}=await current(req);
  const ws=check(await supabase.from('workspaces').select('id,name').eq('id',member.workspace_id).single());
  const members=check(await supabase.from('workspace_members').select('id,user_id,role,created_at,user_profiles(email)').eq('workspace_id',member.workspace_id))??[];
  const admin=['owner','admin'].includes(member.role);
  const invitations=admin?(check(await supabase.from('workspace_invitations').select('id,email,role,created_at').eq('workspace_id',member.workspace_id).eq('status','pending'))??[]):[];
  res.json({...ws,role:member.role.toUpperCase(),permissions:member.role==='owner'?['members:manage','members:invite']:admin?['members:invite']:[],
    members:members.map((m:any)=>({id:m.id,email:m.user_profiles?.email??'Unknown',role:m.role.toUpperCase(),joinedAt:m.created_at})),
    invitations:invitations.map(i=>({id:i.id,email:i.email,role:i.role.toUpperCase(),sentAt:i.created_at}))});
});
router.post('/workspaces/current/invitations',async(req,res)=>{
  const {u,member}=await current(req);if(!['owner','admin'].includes(member.role))throw new HttpError(403,'FORBIDDEN');
  const email=req.body?.email,role=String(req.body?.role??'').toLowerCase();
  if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||!roleValid(role))throw new HttpError(400,'INVALID_INVITATION');
  const raw=token();
  const inv=check(await supabase.from('workspace_invitations').insert({workspace_id:member.workspace_id,email:email.toLowerCase(),
    role,token_hash:digest(raw),invited_by:u.id,expires_at:new Date(Date.now()+7*86400000).toISOString(),status:'pending'}).select('id').single());
  const recipient=check(await supabase.from('user_profiles').select('id').eq('email',email.toLowerCase()).maybeSingle());
  if(recipient)check(await supabase.from('notifications').insert({user_id:recipient.id,workspace_id:member.workspace_id,
    type:'INVITATION',title:'Workspace invitation',body:'You have a pending workspace invitation.',metadata:{invitationId:inv!.id}}));
  // No email provider is silently invoked. The sender can share the one-time link.
  res.status(201).json({id:inv!.id,token:raw,delivery:'manual-link'});
});
router.post('/workspaces/invitations/accept',async(req,res)=>{
  const u=await user(req);if(!u.verified)throw new HttpError(403,'VERIFIED_EMAIL_REQUIRED');
  if(typeof req.body?.token!=='string'||req.body.token.length>512)throw new HttpError(400,'INVALID_INVITATION');
  const {data,error}=await supabase.rpc('accept_workspace_invitation',{p_hash:digest(req.body.token),p_user:u.id,p_email:u.email});
  if(error)throw new HttpError(403,'INVALID_INVITATION');res.json({success:true,workspaceId:data});
});
router.patch('/workspaces/current/members/:id',async(req,res)=>{
  const {u,member}=await current(req);const role=String(req.body?.role??'').toLowerCase();
  if(member.role!=='owner'||!roleValid(role))throw new HttpError(403,'OWNER_REQUIRED');
  if(!uuid(req.params.id))throw new HttpError(404,'NOT_FOUND');
  const target=check(await supabase.from('workspace_members').select('*').eq('id',req.params.id).eq('workspace_id',member.workspace_id).maybeSingle());
  if(!target||target.role==='owner'||target.user_id===u.id)throw new HttpError(403,'ROLE_CHANGE_FORBIDDEN');
  check(await supabase.from('workspace_members').update({role}).eq('id',target.id));
  const p=check(await supabase.from('user_profiles').select('email').eq('id',target.user_id).single());
  res.json({id:target.id,email:p?.email,role:role.toUpperCase(),joinedAt:target.created_at});
});
router.delete('/workspaces/current/members/:id',async(req,res)=>{
  const {u,member}=await current(req);if(member.role!=='owner'||!uuid(req.params.id))throw new HttpError(403,'OWNER_REQUIRED');
  const target=check(await supabase.from('workspace_members').select('id,role,user_id').eq('id',req.params.id).eq('workspace_id',member.workspace_id).maybeSingle());
  if(!target||target.role==='owner'||target.user_id===u.id)throw new HttpError(403,'ROLE_CHANGE_FORBIDDEN');
  check(await supabase.from('workspace_members').delete().eq('id',target.id));res.json({success:true});
});
const keySummary=(k:any)=>({id:k.id,name:k.name,prefix:k.key_prefix,scopes:k.scopes,createdAt:k.created_at,lastUsedAt:k.last_used_at,revokedAt:k.is_revoked?k.updated_at??k.created_at:null});
router.get('/keys',async(req,res)=>{
  const u=await user(req),keys=check(await supabase.from('api_keys').select('id,name,key_prefix,scopes,created_at,last_used_at,is_revoked').eq('user_id',u.id))??[];
  res.json({keys:keys.map(keySummary)});
});
router.post('/keys',async(req,res)=>{
  const u=await user(req);const {name,scopes}=req.body??{};
  if(typeof name!=='string'||!name.trim()||name.length>100||!Array.isArray(scopes)||!scopes.length||
    scopes.some(s=>!['secrets:create','secrets:read','secrets:revoke','audit:read'].includes(s)))throw new HttpError(400,'INVALID_KEY');
  const raw='ss_'+token();const k=check(await supabase.from('api_keys').insert({user_id:u.id,name:name.trim(),scopes:[...new Set(scopes)],
    key_prefix:raw.slice(0,10),key_hash:digest(raw),rate_limit_per_minute:60}).select('id,name,key_prefix,scopes,created_at,last_used_at,is_revoked').single());
  res.status(201).json({key:raw,summary:keySummary(k)});
});
router.delete('/keys/:id',async(req,res)=>{
  const u=await user(req);if(!uuid(req.params.id))throw new HttpError(404,'NOT_FOUND');
  const data=check(await supabase.from('api_keys').update({is_revoked:true}).eq('id',req.params.id).eq('user_id',u.id).select('id'));
  if(!data?.length)throw new HttpError(404,'NOT_FOUND');res.json({success:true});
});
router.post('/keys/:id/rotate',async(req,res)=>{
  const u=await user(req);if(!uuid(req.params.id))throw new HttpError(404,'NOT_FOUND');
  const raw='ss_'+token();const {data,error}=await supabase.rpc('rotate_api_key',{p_id:req.params.id,p_user:u.id,p_hash:digest(raw),p_prefix:raw.slice(0,10)});
  if(error)throw new HttpError(403,'KEY_ROTATION_FORBIDDEN');
  const k=check(await supabase.from('api_keys').select('id,name,key_prefix,scopes,created_at,last_used_at,is_revoked').eq('id',data).single());
  res.json({key:raw,summary:keySummary(k)});
});
router.get('/keys/:id/usage',async(req,res)=>{
  const u=await user(req);if(!uuid(req.params.id))throw new HttpError(404,'NOT_FOUND');
  const k=check(await supabase.from('api_keys').select('id').eq('id',req.params.id).eq('user_id',u.id).maybeSingle());
  if(!k)throw new HttpError(404,'NOT_FOUND');
  res.json({usage:check(await supabase.from('api_usage').select('route,created_at').eq('api_key_id',k.id).order('created_at',{ascending:false}).limit(1000))});
});
router.get('/notifications',async(req,res)=>{
  const u=await user(req);const notes=check(await supabase.from('notifications').select('id,type,title,body,created_at,is_read').eq('user_id',u.id).order('created_at',{ascending:false}).limit(200))??[];
  res.json({notifications:notes.map(n=>({id:n.id,kind:n.type,title:n.title,body:n.body,createdAt:n.created_at,read:n.is_read}))});
});
router.post('/notifications/:id/read',async(req,res)=>{
  const u=await user(req);if(!uuid(req.params.id))throw new HttpError(404,'NOT_FOUND');
  check(await supabase.from('notifications').update({is_read:true,read_at:new Date().toISOString()}).eq('id',req.params.id).eq('user_id',u.id));res.json({success:true});
});
router.get('/notifications/preferences',async(req,res)=>{
  const u=await user(req);res.json({preferences:check(await supabase.from('notification_preferences').select('threat_alerts,access_notifications,expiration_notices,email_delivery').eq('user_id',u.id).maybeSingle())??{threat_alerts:true,access_notifications:true,expiration_notices:true,email_delivery:false}});
});
router.patch('/notifications/preferences',async(req,res)=>{
  const u=await user(req);const data:any={user_id:u.id};
  for(const k of ['threat_alerts','access_notifications','expiration_notices'])if(k in (req.body??{})) {
    if(typeof req.body[k]!=='boolean')throw new HttpError(400,'INVALID_PREFERENCE');data[k]=req.body[k];
  }
  if(req.body?.email_delivery===true)throw new HttpError(409,'EMAIL_DELIVERY_NOT_CONFIGURED');
  if(req.body?.email_delivery===false)data.email_delivery=false;
  check(await supabase.from('notification_preferences').upsert(data));res.json({success:true});
});

async function scopedAudit(req:any) {
  const u=await user(req),ids=await visibleSecretIds(u.id);
  const memberships=check(await supabase.from('workspace_members').select('workspace_id').eq('user_id',u.id))??[];
  const ws=memberships.map(m=>m.workspace_id),filters=[];
  if(ids.length)filters.push(`and(resource_type.eq.secret,resource_id.in.(${ids.join(',')}))`);
  if(ws.length)filters.push(`and(resource_type.eq.workspace,workspace_id.in.(${ws.join(',')}))`);
  if(!filters.length)return [];
  return check(await supabase.from('tamper_audit_logs').select('*').or(filters.join(','))
    .order('sequence_number').limit(1000))??[];
}
export function verifyRows(rows:any[]) {
  const heads=new Map<string,{index:number,hash:string}>();
  for(const row of rows) {
    if(!row.chain_key||!row.chain_index)return {verified:false,firstFailureId:row.event_id};
    const previous=heads.get(row.chain_key)??{index:0,hash:'0'.repeat(64)};
    let payload:any;try {payload=JSON.parse(row.canonical_payload)}catch{return {verified:false,firstFailureId:row.event_id}}
    if(Number(row.chain_index)!==previous.index+1||row.previous_hash!==previous.hash||
      digest(previous.hash+row.canonical_payload)!==row.current_hash||payload.eventId!==row.event_id||
      payload.chain!==row.chain_key||Number(payload.index)!==Number(row.chain_index)||payload.action!==row.action||
      payload.resourceId!==row.resource_id||payload.actor!==row.actor_id||payload.resourceType!==row.resource_type||
      payload.workspaceId!==row.workspace_id||Date.parse(payload.timestamp)!==Date.parse(row.timestamp)||
      JSON.stringify(payload.metadata)!==JSON.stringify(row.metadata))return {verified:false,firstFailureId:row.event_id};
    heads.set(row.chain_key,{index:Number(row.chain_index),hash:row.current_hash});
  }
  return {verified:true};
}
router.get('/audit',async(req,res)=>{
  const rows=await scopedAudit(req);res.json({entries:rows.map(r=>({id:r.event_id,category:r.resource_type,type:r.action,
    occurredAt:r.timestamp,hash:r.current_hash,prevHash:r.previous_hash,chainKey:r.chain_key,index:r.chain_index,canonicalPayload:r.canonical_payload})),truncated:rows.length===1000});
});
router.get('/audit/verify',async(req,res)=>{
  const rows=await scopedAudit(req);const verdict=verifyRows(rows);
  if(rows.length===1000)throw new HttpError(413,'AUDIT_PAGINATION_REQUIRED');
  const u=(await identity(req,true))!;
  const accessible=new Set((await visibleSecretIds(u.id)).map(id=>'secret:'+id));
  const memberships=check(await supabase.from('workspace_members').select('workspace_id').eq('user_id',u.id))??[];
  for(const membership of memberships)accessible.add('workspace:'+membership.workspace_id);
  const file=process.env.AUDIT_CHECKPOINT_FILE??'.audit-checkpoints.jsonl',key=process.env.AUDIT_SIGNING_KEY;
  const checkedAt=new Date().toISOString();
  const chains=new Map<string,any[]>();
  for(const row of rows) {const chain=chains.get(row.chain_key)??[];chain.push(row);chains.set(row.chain_key,chain);}
  const checkpoints=[...chains.entries()].map(([chainKey,chain])=>({userId:u.id,chainKey,checkedAt,count:chain.length,head:chain.at(-1)?.current_hash??''}));
  if(existsSync(file)&&key) {
    const history=readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
    for(const entry of history.filter(e=>e.checkpoint.userId===u.id)) {
      if(crypto.createHmac('sha256',key).update(JSON.stringify(entry.checkpoint)).digest('hex')!==entry.signature)
        throw new HttpError(409,'CHECKPOINT_SIGNATURE_INVALID');
      const chain=chains.get(entry.checkpoint.chainKey)??(accessible.has(entry.checkpoint.chainKey)?[]:undefined);
      if(chain&&(entry.checkpoint.count>chain.length||entry.checkpoint.count>0&&chain[entry.checkpoint.count-1]?.current_hash!==entry.checkpoint.head))
        throw new HttpError(409,'AUDIT_CHECKPOINT_MISMATCH');
    }
  }
  const signed=[];
  if(verdict.verified&&key) {
    for(const checkpoint of checkpoints) {
      const signature=crypto.createHmac('sha256',key).update(JSON.stringify(checkpoint)).digest('hex');
      appendFileSync(file,JSON.stringify({checkpoint,signature})+'\n');signed.push({checkpoint,signature});
    }
  }
  res.json({...verdict,checkedAt,entriesChecked:rows.length,
    checkpoints:signed,anchoring:'local backend HMAC checkpoint; independent external anchoring not configured'});
});
router.get('/threats',async(req,res)=>{
  const u=await user(req),ids=await visibleSecretIds(u.id);const range=String(req.query.range??'24h');
  const days=range==='30d'?30:range==='7d'?7:1;
  const incidents=ids.length?(check(await supabase.from('threat_incidents').select('id,severity,incident_type,description,details,created_at,target_secret_id,defensive_action,risk_score')
    .in('target_secret_id',ids).gte('created_at',new Date(Date.now()-days*86400000).toISOString()).order('created_at',{ascending:false}).limit(500))??[]):[];
  const score=Math.min(100,incidents.reduce((n,i)=>Math.max(n,i.risk_score),0));
  const rules=check(await supabase.from('threat_rules').select('id,name,description').eq('is_active',true))??[];
  res.json({truncated:incidents.length===500||ids.length===1000,riskScore:score,riskLevel:score>=80?'CRITICAL':score>=50?'HIGH':score>=25?'MEDIUM':'LOW',
    incidents:incidents.map(i=>({id:i.id,severity:i.severity,rule:i.incident_type,summary:i.description,
      explanation:`${i.details?.observations??0} observations; threshold ${i.details?.threshold??'configured'} within ${i.details?.windowSeconds??0} seconds.`,
      occurredAt:i.created_at,secretId:i.target_secret_id,actionTaken:i.defensive_action})),
    activeDefenses:incidents.filter(i=>i.defensive_action?.startsWith('Temporary')&&Date.parse(i.created_at)+600000>Date.now())
      .map(i=>({id:i.id,label:i.defensive_action,expiresAt:new Date(Date.parse(i.created_at)+600000).toISOString()})),
    rules:rules.map(r=>({id:r.id,title:r.name,description:r.description}))});
});
router.get('/analytics',async(req,res)=>{
  const u=await user(req),ids=await visibleSecretIds(u.id);
  const since=typeof req.query.since==='string'?req.query.since:new Date(Date.now()-30*86400000).toISOString();
  if(!Number.isFinite(Date.parse(since)))throw new HttpError(400,'INVALID_DATE_RANGE');
  const events=ids.length?(check(await supabase.from('access_events').select('event_type,created_at').in('secret_id',ids).gte('created_at',since).order('created_at',{ascending:false}).limit(1000))??[]):[];
  const counts:Record<string,number>={};for(const e of events)counts[e.event_type]=(counts[e.event_type]??0)+1;
  res.json({secretCount:ids.length,eventCount:events.length,counts,events,truncated:events.length===1000||ids.length===1000});
});
export default router;
