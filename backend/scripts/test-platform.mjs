import 'dotenv/config';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyRows} from '../dist/routes/platform.js';
import {databaseClient} from './database-client.mjs';
config({path:'../frontendv2/.env.local',quiet:true});
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const base=process.env.TEST_API_URL??'http://localhost:5000',users=[],secrets=[],workspaces=[];
const rawDb=databaseClient();
const managementTokens=new Map();
async function call(path,session,method='GET',body) {
  const r=await fetch(base+path,{method,headers:{...(session?{Authorization:`Bearer ${session.jwt}`} :{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,body:await r.json()};
}
async function account() {
  const email=`ss-platform-${randomUUID()}@example.invalid`,password=randomBytes(32).toString('base64url');
  const created=await db.auth.admin.createUser({email,password,email_confirm:true});assert.equal(created.error,null);users.push(created.data.user.id);
  const client=createClient(process.env.SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const signed=await client.auth.signInWithPassword({email,password});assert.equal(signed.error,null);
  return {id:created.data.user.id,email,jwt:signed.data.session.access_token};
}
try {
  await rawDb.connect();
  const a=await account(),b=await account(),outsider=await account();
  assert.equal((await call('/api/account',a)).status,200);
  assert.equal((await call('/api/account',b)).status,200);
  const ws=await call('/api/workspaces',a,'POST',{name:'Disposable integration workspace'});assert.equal(ws.status,201);workspaces.push(ws.body.id);
  const inv=await call('/api/workspaces/current/invitations',a,'POST',{email:b.email,role:'AUDITOR'});assert.equal(inv.status,201);
  assert.equal((await call('/api/workspaces/invitations/accept',outsider,'POST',{token:inv.body.token})).status,403,'wrong email invitation denied');
  assert.equal((await call('/api/workspaces/invitations/accept',b,'POST',{token:inv.body.token})).status,200);
  assert.equal((await call('/api/workspaces/invitations/accept',b,'POST',{token:inv.body.token})).status,403,'invitation is one time');
  const members=await call('/api/workspaces/current',b);assert.equal(members.body.role,'AUDITOR');
  const auditor=members.body.members.find(m=>m.email===b.email);
  assert.equal((await call(`/api/workspaces/current/members/${auditor.id}`,b,'PATCH',{role:'ADMIN'})).status,403,'cannot escalate own role');
  assert.equal((await call('/api/workspaces/current',outsider)).status,404,'unrelated workspace isolated');
  const makeSecret=async(session,workspaceId)=>{
    const r=await call('/api/secrets',session,'POST',{encryptedContent:'AAAAAAAAAAAAAAAAAAAAAA==',iv:'AAAAAAAAAAAAAAAA',workspaceId,expiresAt:new Date(Date.now()+3600000).toISOString()});
    assert.equal(r.status,201);secrets.push(r.body.secretId);managementTokens.set(r.body.secretId,r.body.managementToken);return r.body.secretId;
  };
  const secret=await makeSecret(a,ws.body.id);
  assert.equal((await call(`/api/secrets/${secret}/dashboard`,b)).status,200,'auditor can read workspace activity');
  assert.equal((await call(`/api/secrets/${secret}/revoke`,b,'POST')).status,403,'auditor cannot revoke');
  assert.equal((await call(`/api/secrets/${secret}/dashboard`,outsider)).status,403);
  assert.equal((await call(`/api/workspaces/current/members/${auditor.id}`,a,'PATCH',{role:'MEMBER'})).status,200);
  assert.equal((await call(`/api/secrets/${secret}/revoke`,b,'POST')).status,403,'member cannot revoke another sender secret');
  const memberSecret=await makeSecret(b,ws.body.id);
  assert.equal((await call(`/api/secrets/${memberSecret}/revoke`,b,'POST')).status,200,'member manages own secret');
  assert.equal((await call(`/api/workspaces/current/members/${auditor.id}`,a,'DELETE')).status,200);
  const removed=await fetch(`${base}/api/secrets/${memberSecret}/dashboard`,{headers:{Authorization:`Bearer ${b.jwt}`,'X-Management-Token':managementTokens.get(memberSecret)}});
  assert.equal(removed.status,403,'management capability cannot bypass workspace removal');
  const apiKey=await call('/api/keys',a,'POST',{name:'Disposable test key',scopes:['secrets:create']});assert.equal(apiKey.status,201);
  const api={jwt:apiKey.body.key};
  const apiSecret=await call('/api/v1/secrets',api,'POST',{encryptedContent:'AAAAAAAAAAAAAAAAAAAAAA==',iv:'AAAAAAAAAAAAAAAA',expiresAt:new Date(Date.now()+3600000).toISOString()});
  assert.equal(apiSecret.status,201,'versioned scoped API creation');secrets.push(apiSecret.body.secretId);
  assert.equal((await call(`/api/secrets/${apiSecret.body.secretId}/revoke`,api,'POST')).status,403,'scope enforcement');
  assert.equal((await call('/api/keys',api)).status,403,'API key cannot manage other keys');
  const rotated=await call(`/api/keys/${apiKey.body.summary.id}/rotate`,a,'POST');assert.equal(rotated.status,200,'atomic key rotation');
  assert.equal((await call(`/api/keys/${rotated.body.summary.id}`,a,'DELETE')).status,200);
  assert.equal((await call('/api/v1/secrets',api,'POST',{encryptedContent:'AA==',iv:'AAAAAAAAAAAAAAAA',expiresAt:new Date(Date.now()+3600000).toISOString()})).status,401,'revoked key denied');
  const verify=await call('/api/audit/verify',a);assert.equal(verify.status,200);assert.equal(verify.body.verified,true,'real hash chain verifies');
  const history=await call('/api/audit',a);assert.equal(history.status,200);
  assert.ok(history.body.entries.some(e=>e.category==='workspace'&&e.type.startsWith('MEMBERSHIP_')),'workspace membership changes audited');
  const rows=(await db.from('tamper_audit_logs').select('*').eq('resource_id',secret).order('chain_index')).data;
  assert.ok(rows.length);assert.equal(verifyRows(rows).verified,true);
  const mutated=structuredClone(rows);mutated[0].action='ALTERED';assert.equal(verifyRows(mutated).verified,false,'tampering detected');
  const edit=await db.from('tamper_audit_logs').update({action:'ALTERED'}).eq('event_id',rows[0].event_id);assert.ok(edit.error,'backend cannot edit audit records');
  const source='test:'+randomUUID();
  const failureRule=(await db.from('threat_rules').select('threshold').in('rule_type',['failed_password','FAILED_PASSWORD_THRESHOLD']).eq('is_active',true).limit(1).single()).data;
  assert.ok(failureRule&&failureRule.threshold<=20,'test requires a bounded active failure rule');
  for(let i=0;i<failureRule.threshold;i++)assert.equal((await db.rpc('observe_security_event',{p_secret:secret,p_source:source,p_event:'FAILED_PASSWORD'})).error,null);
  const threats=await call('/api/threats',a);assert.equal(threats.status,200);assert.ok(threats.body.incidents.some(i=>i.secretId===secret),'real incident persisted');
  const notes=await call('/api/notifications',a);assert.equal(notes.status,200);assert.ok(notes.body.notifications.length,'real threat notification');
  const note=notes.body.notifications[0];assert.equal((await call(`/api/notifications/${note.id}/read`,a,'POST')).status,200);
  assert.equal((await call('/api/notifications',a)).body.notifications.find(n=>n.id===note.id).read,true,'read status persisted');
  assert.equal((await call('/api/notifications',outsider)).body.notifications.length,0,'notification isolation');
  const analytics=await call('/api/analytics',a);assert.equal(analytics.status,200);assert.ok(analytics.body.counts.MESSAGE_CREATED>=2);
  assert.equal((await call('/api/notifications/preferences',a,'PATCH',{access_notifications:false})).status,200);
  const beforeAccess=(await call('/api/notifications',a)).body.notifications.filter(n=>n.kind==='ACCESS').length;
  assert.equal((await call(`/api/secrets/${apiSecret.body.secretId}/access`,a,'POST',{})).status,200);
  assert.equal((await call('/api/notifications',a)).body.notifications.filter(n=>n.kind==='ACCESS').length,beforeAccess,'disabled access notices respected');
  const expiry=await makeSecret(a);
  assert.equal((await db.from('secrets').update({expires_at:new Date(Date.now()-3600000).toISOString()}).eq('id',expiry)).error,null);
  assert.equal((await db.rpc('expire_secrets',{p_ids:[expiry]})).data,1,'expiry worker transition');
  assert.equal((await db.rpc('expire_secrets',{p_ids:[expiry]})).data,0,'expiry transition idempotent');
  assert.equal((await db.from('secrets').select('encrypted_content').eq('id',expiry).single()).data.encrypted_content,'','expired ciphertext erased');
  assert.ok((await call('/api/notifications',a)).body.notifications.some(n=>n.kind==='EXPIRY'),'expiry notification persisted');
  const operationDenied=await fetch(base+'/api/metrics');assert.equal(operationDenied.status,403);
  const operationAllowed=await fetch(base+'/api/metrics',{headers:{'X-Operations-Token':process.env.OPERATIONS_TOKEN}});
  assert.equal(operationAllowed.status,200);assert.equal(typeof (await operationAllowed.json()).requests,'number');
  const spec=await fetch(base+'/api/openapi.json');assert.equal(spec.status,200);assert.ok((await spec.json()).paths['/api/v1/secrets']);
  const cors=await fetch(base+'/api/health',{headers:{Origin:'https://untrusted.example.invalid'}});assert.equal(cors.status,403);
  assert.match(cors.headers.get('X-Request-ID'),/^[0-9a-f-]{36}$/);
  assert.equal((await call('/api/v1/account',a)).status,200,'versioned account alias');
  await rawDb.query('begin');
  for(const id of [a.id,b.id]) {
    await rawDb.query('savepoint identity_check');
    await rawDb.query('set local role authenticated');
    await rawDb.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);
    await assert.rejects(()=>rawDb.query('select id from public.secrets limit 1'),e=>e.code==='42501','direct browser table access denied for both identities');
    await rawDb.query('rollback to savepoint identity_check');
  }
  await rawDb.query('rollback');
  console.log('PASS: workspace membership/invitation replay/isolation/auditor permissions; scoped versioned API keys/revocation; audit chain/immutability/tamper detection; real threat incidents; persistent isolated notifications; account analytics; direct-table denial under two JWT identities.');
} finally {
  await rawDb.query('rollback').catch(()=>{});
  if(secrets.length)await db.from('secrets').delete().in('id',secrets);
  // Immutable audit records intentionally remain. Their workspace references must
  // remain valid, so retain the isolated fixture workspace, with no user members.
  if(users.length)await db.from('user_profiles').delete().in('id',users);
  for(const id of users)await db.auth.admin.deleteUser(id);
  await rawDb.end();
}
