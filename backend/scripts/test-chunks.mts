import 'dotenv/config'
import {config} from 'dotenv'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {generateEncryptionKey,encryptMessage,decryptMessage} from '../../frontendv2/lib/encryption.ts'
import {uploadChunkedFile,decryptedChunkStream} from '../../frontendv2/lib/chunked-files.ts'
config({path:'../frontendv2/.env.local',quiet:true})
const base=process.env.TEST_API_URL??'http://localhost:5000'
const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
const key=await generateEncryptionKey(),encrypted=await encryptMessage('chunk integration fixture',key)
const response=await fetch(base+'/api/secrets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({encryptedContent:encrypted.ciphertext,iv:encrypted.iv,burnAfterRead:true,
  accessStart:new Date(Date.now()+360000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()})})
assert.equal(response.status,201)
const secret=await response.json(),originalFetch=globalThis.fetch
let sessionId='',puts=new Map<number,number>(),tamper=false
globalThis.fetch=async(input,options={})=>{
  const url=String(input),headers=new Headers(options.headers)
  if(url.startsWith(base+'/api/secrets/'+secret.secretId+'/uploads'))headers.set('X-Management-Token',secret.managementToken)
  if(options.method==='PUT'){const index=Number(url.split('/').at(-1));puts.set(index,(puts.get(index)??0)+1)}
  const r=await originalFetch(input,{...options,headers})
  if(options.method==='POST'&&url.endsWith('/uploads'))sessionId=(await r.clone().json()).id
  if(tamper&&(!options.method||options.method==='GET')&&url.includes('/chunks/')){
    const bytes=new Uint8Array(await r.arrayBuffer());bytes[0]^=1;return new Response(bytes,{status:200})
  }
  return r
}
try {
  const bytes=new Uint8Array(2*1024*1024+1024).map((_,i)=>i%251)
  const file=new File([bytes],'fixture.bin',{type:'application/octet-stream'})
  const controller=new AbortController()
  await assert.rejects(()=>uploadChunkedFile(secret.secretId,file,key,{signal:controller.signal,onProgress:f=>{if(f>0)controller.abort()}}),e=>e instanceof DOMException&&e.name==='AbortError')
  assert.ok(sessionId)
  assert.equal((await db.from('upload_chunks').select('id',{count:'exact',head:true}).eq('session_id',sessionId)).count,1,'cancellation retained first chunk')
  await uploadChunkedFile(secret.secretId,file,key)
  assert.equal(puts.get(0),1,'resume skipped completed encrypted chunk')
  const row=(await db.from('secret_attachments').select('encrypted_key_bundle').eq('id',sessionId).single()).data!
  const bundle=JSON.parse(row.encrypted_key_bundle),manifest=JSON.parse(await decryptMessage(bundle.ciphertext,bundle.iv,key))
  assert.equal(manifest.totalChunks,3)
  assert.equal((await db.from('secrets').update({access_start:new Date(Date.now()-3600000).toISOString()}).eq('id',secret.secretId)).error,null)
  const access=await originalFetch(`${base}/api/secrets/${secret.secretId}/access`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})
  const result=await access.json();assert.equal(access.status,200,`access code: ${result.code??'none'}`);assert.equal(result.destroyedAfterAccess,true)
  const parts=[];for await(const b of decryptedChunkStream(secret.secretId,manifest,result.accessToken))parts.push(b)
  assert.deepEqual(new Uint8Array(await new Blob(parts).arrayBuffer()),bytes,'chunk authentication and round trip')
  tamper=true
  await assert.rejects(async()=>{for await(const b of decryptedChunkStream(secret.secretId,manifest,result.accessToken))void b},/integrity mismatch/,'tampering rejected before yielding plaintext')
  tamper=false
  const anon=createClient(process.env.SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}})
  assert.ok((await anon.storage.from('secure-attachments').download(`${secret.secretId}/chunks/${sessionId}/0`)).error,'direct anonymous private storage download denied')
  assert.ok((await anon.storage.from('secure-attachments').upload(`${secret.secretId}/unauthorized`,new Blob(['ciphertext fixture']))).error,'direct anonymous upload denied')
  console.log('PASS: scheduled sender upload; cancellation and same-session resume; chunk nonce/order/hash authentication; atomic completion; chunked burn delivery; tamper rejection; anonymous storage upload/download denial.')
} finally {
  globalThis.fetch=originalFetch
  const paths=(await db.from('upload_chunks').select('storage_path').eq('session_id',sessionId)).data??[]
  if(paths.length)await db.storage.from('secure-attachments').remove(paths.map(p=>p.storage_path))
  await db.from('secrets').delete().eq('id',secret.secretId)
}
