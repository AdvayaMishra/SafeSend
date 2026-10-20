import { Router } from 'express';
import argon2 from 'argon2';
import { supabase } from '../config/supabase.js';
import { HttpError,check,identity,profile,secretRecord,manage,available,token,digest,uuid } from '../security.js';
import { observe } from '../threats.js';
import {visibleSecretIds} from './platform.js';

const router=Router();
const metadata=(s:any)=>({id:s.id,createdAt:s.created_at,expiresAt:s.expires_at,
  accessStart:s.access_start,accessEnd:s.access_end,maxViews:s.max_views,viewCount:s.view_count,
  viewsRemaining:s.max_views===null?null:Math.max(s.max_views-s.view_count,0),
  viewOnce:s.burn_after_read,requiresPassword:!!s.password_hash,failedAttempts:s.failed_attempts,
  cooldownUntil:s.cooldown_until,status:s.status,destroyedAt:s.destroyed_at,isSuspended:s.is_suspended});
const timestamp=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
router.get('/',async(req,res)=>{
  const user=(await identity(req,true))!;
  const ids=await visibleSecretIds(user.id);
  res.json({success:true,secrets:ids.map(id=>({id})),truncated:ids.length===1000});
});

router.post('/',async(req,res)=>{
  const b=req.body ?? {};
  if(typeof b.encryptedContent!=='string'||b.encryptedContent.length>1024*1024||
    !/^[A-Za-z0-9+/=_-]+$/.test(b.encryptedContent)||typeof b.iv!=='string'||
    !/^[A-Za-z0-9+/=_-]{16}$/.test(b.iv)||!timestamp(b.expiresAt)||Date.parse(b.expiresAt)<=Date.now())
    throw new HttpError(400,'INVALID_ENCRYPTED_PAYLOAD');
  if(b.password!==undefined&&(typeof b.password!=='string'||b.password.length>1024)) throw new HttpError(400,'INVALID_PASSWORD');
  if(b.maxViews!=null&&(!Number.isInteger(b.maxViews)||b.maxViews<1||b.maxViews>1000000)) throw new HttpError(400,'INVALID_VIEW_LIMIT');
  if(b.burnAfterRead!==undefined&&typeof b.burnAfterRead!=='boolean') throw new HttpError(400,'INVALID_POLICY');
  if((b.accessStart&&!timestamp(b.accessStart))||(b.accessEnd&&!timestamp(b.accessEnd))||
    (b.accessStart&&b.accessEnd&&Date.parse(b.accessEnd)<=Date.parse(b.accessStart))) throw new HttpError(400,'INVALID_ACCESS_WINDOW');
  if(b.recipientEmail!=null&&(typeof b.recipientEmail!=='string'||!/^\S+@\S+\.\S+$/.test(b.recipientEmail)||b.recipientEmail.length>254)) throw new HttpError(400,'INVALID_RECIPIENT');
  const user=await identity(req);
  if(user) await profile(user);
  if(b.workspaceId) {
    if(!user||!uuid(b.workspaceId)) throw new HttpError(403,'WORKSPACE_FORBIDDEN');
    const m=check(await supabase.from('workspace_members').select('role').eq('workspace_id',b.workspaceId).eq('user_id',user.id).maybeSingle());
    if(!m||m.role==='auditor') throw new HttpError(403,'WORKSPACE_FORBIDDEN');
  }
  const managementToken=token();
  const data=check(await supabase.from('secrets').insert({encrypted_content:b.encryptedContent,iv:b.iv,
    password_hash:b.password?await argon2.hash(b.password):null,expires_at:b.expiresAt,
    access_start:b.accessStart||null,access_end:b.accessEnd||null,max_views:b.maxViews??null,
    burn_after_read:b.burnAfterRead??false,recipient_email:b.recipientEmail?.toLowerCase()||null,
    created_by_user_id:user?.id??null,workspace_id:b.workspaceId||null,management_token_hash:digest(managementToken)})
    .select('id').single());
  if(!data) throw new HttpError(503,'DATABASE_UNAVAILABLE');
  check(await supabase.from('access_events').insert({secret_id:data.id,event_type:'MESSAGE_CREATED'}));
  res.status(201).json({success:true,secretId:data.id,managementToken});
});

router.get('/:id',async(req,res)=>{
  const secret=await secretRecord(req.params.id);available(secret);
  res.json({success:true,...metadata(secret)});
});
router.post('/:id/access',async(req,res)=>{
  const secret=await secretRecord(req.params.id);
  await observe(req,secret.id,'ACCESS_ATTEMPT');
  try {available(secret)} catch(error) {
    if(error instanceof HttpError) await observe(req,secret.id,error.code==='SECRET_EXPIRED'?'EXPIRED_ACCESS':'POLICY_DENIED');
    throw error;
  }
  const user=await identity(req);
  if(secret.recipient_email&&(!user?.verified||user.email!==secret.recipient_email.toLowerCase())) {
    await observe(req,secret.id,'POLICY_DENIED');
    check(await supabase.from('access_events').insert({secret_id:secret.id,event_type:'POLICY_DENIED'}));
    throw new HttpError(403,'RECIPIENT_REQUIRED','Sign in with the verified recipient email.');
  }
  if(secret.password_hash) {
    if(typeof req.body?.password!=='string'||req.body.password.length>1024) throw new HttpError(401,'PASSWORD_REQUIRED');
    if(!await argon2.verify(secret.password_hash,req.body.password)) {
      const failure=check(await supabase.rpc('record_password_failure',{p_id:secret.id}));
      await observe(req,secret.id,'FAILED_PASSWORD');
      return res.status(failure.status??401).json({success:false,code:'INVALID_PASSWORD',message:'Incorrect password',...failure});
    }
  }
  const accessToken=token();
  const data=check(await supabase.rpc('consume_secret',{p_id:secret.id,p_password_hash:secret.password_hash,
    p_email:user?.verified?user.email:null,p_token_hash:digest(accessToken)}));
  if(!data.success) throw new HttpError(data.status??403,data.code??'ACCESS_DENIED');
  res.json({...data,accessToken});
});
router.get('/:id/dashboard',async(req,res)=>{
  const secret=await secretRecord(req.params.id);await manage(req,secret);
  const events=check(await supabase.from('access_events').select('id,event_type,created_at').eq('secret_id',secret.id)
    .order('created_at',{ascending:false}).limit(1000));
  let canManage=true;try {await manage(req,secret,true)}catch(error){if(error instanceof HttpError&&error.status===403)canManage=false;else throw error}
  res.json({success:true,secret:{...metadata(secret),canManage},events});
});
router.post('/:id/revoke',async(req,res)=>{
  const secret=await secretRecord(req.params.id);await manage(req,secret,true);
  check(await supabase.from('secrets').update({status:'revoked',destroyed_at:new Date().toISOString(),encrypted_content:''}).eq('id',secret.id));
  check(await supabase.from('secret_access_tokens').delete().eq('secret_id',secret.id));
  check(await supabase.from('access_events').insert({secret_id:secret.id,event_type:'MESSAGE_REVOKED'}));
  res.json({success:true});
});
router.patch('/:id/policy',async(req,res)=>{
  const secret=await secretRecord(req.params.id);await manage(req,secret,true);
  if(typeof req.body?.suspended!=='boolean') throw new HttpError(400,'INVALID_POLICY');
  check(await supabase.from('secrets').update({is_suspended:req.body.suspended}).eq('id',secret.id));
  check(await supabase.from('access_events').insert({secret_id:secret.id,event_type:req.body.suspended?'ACCESS_SUSPENDED':'ACCESS_RESUMED'}));
  res.json({success:true});
});
export default router;
