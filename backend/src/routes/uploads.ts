import express,{Router} from 'express';
import crypto from 'node:crypto';
import {supabase} from '../config/supabase.js';
import {check,HttpError,secretRecord,manage,uploadAvailable,uuid} from '../security.js';
import {delivery} from './attachments.js';
const router=Router(),CHUNK=1024*1024;
async function session(req:any,write=true) {
  const secret=await secretRecord(req.params.id);if(write){await manage(req,secret,true);uploadAvailable(secret)}else await delivery(req);
  if(!uuid(req.params.session))throw new HttpError(404,'NOT_FOUND');
  const s=check(await supabase.from('upload_sessions').select('*').eq('id',req.params.session).eq('secret_id',secret.id).maybeSingle());
  if(!s)throw new HttpError(404,'NOT_FOUND');
  return s;
}
router.post('/:id/uploads',async(req,res)=>{
  const secret=await secretRecord(req.params.id);await manage(req,secret,true);uploadAvailable(secret);
  const {totalChunks,totalBytes}=req.body??{};
  if(!Number.isInteger(totalChunks)||totalChunks<1||totalChunks>26||!Number.isInteger(totalBytes)||totalBytes<17||totalBytes>25*CHUNK+26*16)
    throw new HttpError(400,'INVALID_UPLOAD_SIZE');
  const id=crypto.randomUUID();
  check(await supabase.from('upload_sessions').insert({id,secret_id:secret.id,file_name:'encrypted.bin',mime_type:'application/octet-stream',
    total_file_size:totalBytes,chunk_size:CHUNK,total_chunks:totalChunks,uploaded_chunks:0,
    storage_path:`${secret.id}/chunks/${id}`,status:'in_progress',expires_at:new Date(Math.min(Date.now()+3600000,Date.parse(secret.expires_at))).toISOString()}));
  res.status(201).json({id,chunkSize:CHUNK});
});
router.get('/:id/uploads/:session',async(req,res)=>{
  const s=await session(req);
  const chunks=check(await supabase.from('upload_chunks').select('chunk_index,chunk_hash,chunk_size').eq('session_id',s.id).order('chunk_index'))??[];
  res.json({id:s.id,status:s.status,totalChunks:s.total_chunks,totalBytes:s.total_file_size,chunks});
});
router.put('/:id/uploads/:session/chunks/:index',async(req,_res,next)=>{
  const s=await session(req);if(s.status!=='in_progress'||Date.parse(s.expires_at)<=Date.now())throw new HttpError(409,'UPLOAD_CLOSED');next();
},express.raw({type:'application/octet-stream',limit:CHUNK+16}),async(req,res)=>{
  const s=await session(req),index=Number(req.params.index),body=req.body;
  if(s.status!=='in_progress'||Date.parse(s.expires_at)<=Date.now())throw new HttpError(409,'UPLOAD_CLOSED');
  if(!Number.isInteger(index)||index<0||index>=s.total_chunks||!Buffer.isBuffer(body)||body.length<17||body.length>CHUNK+16)
    throw new HttpError(400,'INVALID_CHUNK');
  if(index<s.total_chunks-1&&body.length!==CHUNK+16)throw new HttpError(400,'INVALID_CHUNK_SIZE');
  const hash=crypto.createHash('sha256').update(body).digest('hex');
  if(req.get('x-chunk-sha256')!==hash)throw new HttpError(400,'CHUNK_HASH_MISMATCH');
  const existing=check(await supabase.from('upload_chunks').select('chunk_hash').eq('session_id',s.id).eq('chunk_index',index).maybeSingle());
  if(existing) {
    if(existing.chunk_hash!==hash)throw new HttpError(409,'CHUNK_CONFLICT');
    return res.json({success:true,alreadyUploaded:true});
  }
  const path=`${s.storage_path}/${index}`;
  const {error:storageError}=await supabase.storage.from('secure-attachments').upload(path,body,{contentType:'application/octet-stream',upsert:false});
  if(storageError) {
    const stored=check(await supabase.storage.from('secure-attachments').download(path));
    if(!stored||crypto.createHash('sha256').update(Buffer.from(await stored.arrayBuffer())).digest('hex')!==hash)
      throw new HttpError(409,'CHUNK_UPLOAD_RETRY');
  }
  const {error}=await supabase.from('upload_chunks').insert({session_id:s.id,chunk_index:index,chunk_size:body.length,chunk_hash:hash,storage_path:path});
  if(error) {
    const row=check(await supabase.from('upload_chunks').select('chunk_hash').eq('session_id',s.id).eq('chunk_index',index).maybeSingle());
    if(row?.chunk_hash!==hash)throw new HttpError(503,'DATABASE_UNAVAILABLE');
  }
  res.status(201).json({success:true,hash});
});
router.post('/:id/uploads/:session/complete',async(req,res)=>{
  const s=await session(req);const bundle=req.body?.encryptedKeyBundle;
  if(typeof bundle!=='string'||bundle.length<1||bundle.length>32768)throw new HttpError(400,'INVALID_ENCRYPTED_METADATA');
  const {data,error}=await supabase.rpc('finish_upload',{p_session:s.id,p_bundle:bundle});
  if(error)throw new HttpError(409,'UPLOAD_INCOMPLETE');res.json({success:true,attachmentId:data});
});
router.delete('/:id/uploads/:session',async(req,res)=>{
  const s=await session(req);if(s.status==='completed')throw new HttpError(409,'UPLOAD_COMPLETED');
  check(await supabase.from('upload_sessions').update({status:'aborted'}).eq('id',s.id));res.json({success:true});
});
router.get('/:id/uploads/:session/chunks/:index',async(req,res)=>{
  const s=await session(req,false),index=Number(req.params.index);
  if(s.status!=='completed'||!Number.isInteger(index)||index<0||index>=s.total_chunks)throw new HttpError(404,'NOT_FOUND');
  const row=check(await supabase.from('upload_chunks').select('storage_path,chunk_hash').eq('session_id',s.id).eq('chunk_index',index).maybeSingle());
  if(!row)throw new HttpError(404,'NOT_FOUND');
  const blob=check(await supabase.storage.from('secure-attachments').download(row.storage_path));
  if(!blob)throw new HttpError(503,'STORAGE_UNAVAILABLE');
  res.setHeader('X-Chunk-SHA256',row.chunk_hash);res.type('application/octet-stream').send(Buffer.from(await blob.arrayBuffer()));
});
export default router;
