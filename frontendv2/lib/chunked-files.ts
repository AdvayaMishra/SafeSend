import {authHeaders} from './auth'
import {generateEncryptionKey,exportKeyToUrlFragment,importKeyFromUrlFragment,encryptMessage} from './encryption'
const API=process.env.NEXT_PUBLIC_API_URL||'http://localhost:5000'
const CHUNK=1024*1024
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('')
const sha=async(b:Uint8Array)=>hex(await crypto.subtle.digest('SHA-256',b as Uint8Array<ArrayBuffer>))
const nonce=(prefix:Uint8Array,index:number)=>{const out=new Uint8Array(12);out.set(prefix);new DataView(out.buffer).setUint32(8,index,false);return out}
export type ChunkManifest={version:2;sessionId:string;key:string;noncePrefix:number[];name:string;mimeType:string;size:number;totalChunks:number;hashes:string[]}
type State={secretId:string;id:string;key:CryptoKey;prefix:Uint8Array;hashes:string[];count:number;pending?:{index:number;body:Uint8Array;hash:string}}
const states=new WeakMap<File,State>()
async function json(path:string,method:string,body?:unknown,signal?:AbortSignal) {
  const response=await fetch(API+path,{method,headers:{...await authHeaders(path.split('/')[3]),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal})
  const data=await response.json();if(!response.ok)throw new Error(data.message??'Encrypted upload failed.');return data
}
export async function uploadChunkedFile(secretId:string,file:File,masterKey:CryptoKey,
  opts:{signal?:AbortSignal;onProgress?:(fraction:number)=>void}={}) {
  const path=`/api/secrets/${secretId}/uploads`
  let state=states.get(file)
  if(state?.secretId!==secretId)state=undefined
  if(!state) {
    if(!file.size||file.size>25*CHUNK)throw new Error('Files must be between 1 byte and 25 MB.')
    const count=Math.ceil(file.size/CHUNK)
    const created=await json(path,'POST',{totalChunks:count,totalBytes:file.size+count*16},opts.signal)
    state={secretId,id:created.id,key:await generateEncryptionKey(),prefix:crypto.getRandomValues(new Uint8Array(8)),hashes:[],count}
    states.set(file,state)
  }
  const current=await json(`${path}/${state.id}`,'GET',undefined,opts.signal)
  const uploaded=new Map<number,string>(current.chunks.map((c:any)=>[c.chunk_index,c.chunk_hash]))
  for(let i=0;i<state.count;i++) {
    if(opts.signal?.aborted)throw new DOMException('Upload cancelled','AbortError')
    if(uploaded.has(i)) {
      if(uploaded.get(i)!==state.hashes[i])throw new Error('Resumed chunk integrity mismatch.')
      opts.onProgress?.((i+1)/state.count);continue
    }
    if(state.pending?.index!==i) {
      const plaintext=await file.slice(i*CHUNK,Math.min((i+1)*CHUNK,file.size)).arrayBuffer()
      const body=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce(state.prefix,i),
        additionalData:new TextEncoder().encode(`${state.id}:${i}:${state.count}`)},state.key,plaintext))
      const hash=await sha(body);state.hashes[i]=hash;state.pending={index:i,body,hash}
    }
    const pending=state.pending!
    let sent=false
    for(let attempt=0;attempt<3;attempt++) {
      try {
        const response=await fetch(`${API}${path}/${state.id}/chunks/${i}`,{method:'PUT',signal:opts.signal,
          headers:{...await authHeaders(secretId),'Content-Type':'application/octet-stream','X-Chunk-SHA256':pending.hash},body:pending.body as Uint8Array<ArrayBuffer>})
        if(!response.ok)throw new Error('Chunk upload failed.')
        sent=true;break
      }catch(error) {
        if(opts.signal?.aborted||attempt===2)throw error
        await new Promise(resolve=>setTimeout(resolve,300*(attempt+1)))
      }
    }
    if(!sent)throw new Error('Chunk upload failed.')
    state.pending=undefined;opts.onProgress?.((i+1)/state.count)
  }
  const manifest:ChunkManifest={version:2,sessionId:state.id,key:await exportKeyToUrlFragment(state.key),noncePrefix:Array.from(state.prefix),
    name:file.name,mimeType:file.type,size:file.size,totalChunks:state.count,hashes:state.hashes}
  const bundle=await encryptMessage(JSON.stringify(manifest),masterKey)
  await json(`${path}/${state.id}/complete`,'POST',{encryptedKeyBundle:JSON.stringify(bundle)},opts.signal)
  return {success:true}
}
export async function* decryptedChunkStream(secretId:string,manifest:ChunkManifest,accessToken:string,
  opts:{signal?:AbortSignal;onProgress?:(received:number,total:number)=>void}={}) {
  if(manifest.version!==2||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(manifest.sessionId)||manifest.noncePrefix.length!==8||
    manifest.noncePrefix.some(n=>!Number.isInteger(n)||n<0||n>255)||manifest.hashes.length!==manifest.totalChunks||
    manifest.totalChunks!==Math.ceil(manifest.size/CHUNK)||manifest.size<1||manifest.size>25*CHUNK)
    throw new Error('Invalid encrypted file manifest.')
  const key=await importKeyFromUrlFragment(manifest.key)
  let received=0
  for(let i=0;i<manifest.totalChunks;i++) {
    const response=await fetch(`${API}/api/secrets/${secretId}/uploads/${manifest.sessionId}/chunks/${i}`,{headers:{Authorization:`Bearer ${accessToken}`},signal:opts.signal})
    if(!response.ok)throw new Error('Encrypted chunk unavailable.')
    const body=new Uint8Array(await response.arrayBuffer())
    if(await sha(body)!==manifest.hashes[i])throw new Error('File integrity mismatch.')
    const plaintext=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce(Uint8Array.from(manifest.noncePrefix),i),
      additionalData:new TextEncoder().encode(`${manifest.sessionId}:${i}:${manifest.totalChunks}`)},key,body))
    if(plaintext.length!==Math.min(CHUNK,manifest.size-i*CHUNK))throw new Error('Unexpected chunk length.')
    received+=plaintext.length;opts.onProgress?.(received,manifest.size);yield plaintext
  }
}
