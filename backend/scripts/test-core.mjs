import 'dotenv/config';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { generateEncryptionKey,encryptMessage,decryptMessage,encryptFile,decryptFile } from '../../frontendv2/lib/encryption.ts';
config({path:'../frontendv2/.env.local',quiet:true});
const base=process.env.TEST_API_URL??'http://localhost:5000';
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ids=[],objects=[],users=[];
const key=await generateEncryptionKey();
const encrypted=await encryptMessage('local crypto integration fixture',key);
async function request(path,{method='GET',body,headers={}}={}) {
  const response=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
  return {status:response.status,body:await response.json()};
}
async function create(extra={},headers={}) {
  const r=await request('/api/secrets',{method:'POST',headers,body:{encryptedContent:encrypted.ciphertext,iv:encrypted.iv,
    expiresAt:new Date(Date.now()+3600000).toISOString(),...extra}});
  assert.equal(r.status,201,'create encrypted secret');ids.push(r.body.secretId);return r.body;
}
const management=s=>({'X-Management-Token':s.managementToken});
try {
  assert.equal((await request('/api/test-db')).status,200,'real backend database query');
  const s=await create();
  assert.equal((await request(`/api/secrets/${s.secretId}/dashboard`)).status,401,'dashboard needs sender authorization');
  assert.equal((await request(`/api/secrets/${s.secretId}/dashboard`,{headers:management(s)})).status,200);
  const access=await request(`/api/secrets/${s.secretId}/access`,{method:'POST',body:{}});
  assert.equal(access.status,200);assert.equal(await decryptMessage(access.body.encryptedContent,access.body.iv,key),'local crypto integration fixture');
  const wrongKey=await generateEncryptionKey();
  await assert.rejects(()=>decryptMessage(access.body.encryptedContent,access.body.iv,wrongKey));
  const limited=await create({maxViews:1});
  const reads=await Promise.all(Array.from({length:12},()=>request(`/api/secrets/${limited.secretId}/access`,{method:'POST',body:{}})));
  assert.equal(reads.filter(x=>x.status===200).length,1,'concurrent one-view access admits exactly one reader');
  const scheduled=await create({accessStart:new Date(Date.now()+1800000).toISOString()});
  assert.equal((await request(`/api/secrets/${scheduled.secretId}/access`,{method:'POST',body:{}})).status,403);
  const expired=await create();
  assert.equal((await db.from('secrets').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',expired.secretId)).error,null);
  assert.equal((await request(`/api/secrets/${expired.secretId}/access`,{method:'POST',body:{}})).status,410,'expiry enforced');
  const revoked=await create();
  assert.equal((await request(`/api/secrets/${revoked.secretId}/revoke`,{method:'POST',headers:management(revoked)})).status,200);
  assert.equal((await request(`/api/secrets/${revoked.secretId}/access`,{method:'POST',body:{}})).status,410);
  const suspended=await create();
  assert.equal((await request(`/api/secrets/${suspended.secretId}/policy`,{method:'PATCH',headers:management(suspended),body:{suspended:true}})).status,200);
  assert.equal((await request(`/api/secrets/${suspended.secretId}/access`,{method:'POST',body:{}})).status,403);
  const burned=await create({burnAfterRead:true});
  const file=await encryptFile(new Blob(['encrypted attachment fixture']),key);
  const bundle=await encryptMessage(JSON.stringify({iv:file.iv}),key);
  const form=new FormData();form.set('file',file.ciphertext,'encrypted.bin');form.set('encryptedKeyBundle',JSON.stringify(bundle));
  assert.equal((await fetch(`${base}/api/secrets/${burned.secretId}/attachments`,{method:'POST',body:form})).status,401,'upload requires sender');
  const uploaded=await fetch(`${base}/api/secrets/${burned.secretId}/attachments`,{method:'POST',headers:management(burned),body:form});
  assert.equal(uploaded.status,201,'encrypted attachment upload');const attachment=(await uploaded.json()).attachment;
  objects.push(`${burned.secretId}/${attachment.id}`);
  const delivered=await request(`/api/secrets/${burned.secretId}/access`,{method:'POST',body:{}});
  assert.equal(delivered.body.destroyedAfterAccess,true);
  const auth={Authorization:`Bearer ${delivered.body.accessToken}`};
  assert.equal((await request(`/api/secrets/${burned.secretId}/attachments`,{headers:auth})).status,200,'burn delivery grant can list');
  const download=await fetch(`${base}/api/secrets/${burned.secretId}/attachments/${attachment.id}/download`,{headers:auth});
  assert.equal(download.status,200,'burn delivery grant can download');
  assert.equal(await (await decryptFile(await download.blob(),file.iv,key)).text(),'encrypted attachment fixture');
  assert.equal((await request(`/api/secrets/${burned.secretId}/access`,{method:'POST',body:{}})).status,410,'burn cannot be consumed again');
  const sessions=[];
  for(let i=0;i<2;i++) {
    const email=`ss-test-${randomUUID()}@example.invalid`,password=randomBytes(32).toString('base64url');
    const created=await db.auth.admin.createUser({email,password,email_confirm:true});assert.equal(created.error,null,'test account');
    users.push(created.data.user.id);
    const c=createClient(process.env.SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const signed=await c.auth.signInWithPassword({email,password});assert.equal(signed.error,null,'real Auth sign-in');
    sessions.push({email,headers:{Authorization:`Bearer ${signed.data.session.access_token}`}});
  }
  const owned=await create({},sessions[0].headers);
  assert.equal((await request(`/api/secrets/${owned.secretId}/dashboard`,{headers:sessions[1].headers})).status,403,'other account cannot inspect owner secret');
  assert.equal((await request(`/api/secrets/${owned.secretId}/dashboard`,{headers:sessions[0].headers})).status,200);
  const recipient=await create({recipientEmail:sessions[0].email});
  assert.equal((await request(`/api/secrets/${recipient.secretId}/access`,{method:'POST',body:{},headers:sessions[1].headers})).status,403);
  assert.equal((await request(`/api/secrets/${recipient.secretId}/access`,{method:'POST',body:{},headers:sessions[0].headers})).status,200,'verified recipient accepted');
  const protectedSecret=await create({password:'test-Only-long-password!'});
  for(let i=0;i<3;i++)assert.ok([401,429].includes((await request(`/api/secrets/${protectedSecret.secretId}/access`,{method:'POST',body:{password:'incorrect'}})).status));
  assert.equal((await request(`/api/secrets/${protectedSecret.secretId}/access`,{method:'POST',body:{password:'test-Only-long-password!'}})).status,429);
  const {data:protectedRow}=await db.from('secrets').select('status').eq('id',protectedSecret.secretId).single();
  assert.equal(protectedRow.status,'active','password failures never destroy secret');
  console.log('PASS: real DB query; local encryption; sender authorization; concurrent view limit; cooldown; schedule; revoke; suspension; private encrypted burn attachment delivery; two Auth identities; recipient isolation.');
} finally {
  // Remove only disposable fixtures created by this script, identified by exact IDs.
  if(objects.length)await db.storage.from('secure-attachments').remove(objects);
  if(ids.length)await db.from('secrets').delete().in('id',ids);
  if(users.length)await db.from('user_profiles').delete().in('id',users);
  for(const id of users)await db.auth.admin.deleteUser(id);
}
