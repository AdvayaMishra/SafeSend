import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { supabase } from '../config/supabase.js';
import { HttpError,check,secretRecord,manage,available,uploadAvailable,digest,uuid } from '../security.js';
import {observe} from '../threats.js';
const router=Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:25*1024*1024,files:1,fields:1,fieldSize:16384}});

router.post('/:id/attachments',async(req,_res,next)=>{
  const s=await secretRecord(req.params.id);
  try{await manage(req,s,true)}catch(error){if(error instanceof HttpError&&[401,403].includes(error.status))await observe(req,s.id,'ATTACHMENT_REJECTED');throw error}
  uploadAvailable(s);next();
},upload.single('file'),async(req,res)=>{
  const s=await secretRecord(req.params.id);await manage(req,s,true);uploadAvailable(s);
  if(!req.file||!['application/octet-stream','text/plain'].includes(req.file.mimetype)) throw new HttpError(400,'ENCRYPTED_FILE_REQUIRED');
  if(typeof req.body.encryptedKeyBundle!=='string'||req.body.encryptedKeyBundle.length>16384) throw new HttpError(400,'ENCRYPTED_METADATA_REQUIRED');
  const id=crypto.randomUUID(),path=`${s.id}/${id}`;
  check(await supabase.storage.from('secure-attachments').upload(path,req.file.buffer,{contentType:'application/octet-stream',upsert:false}));
  const {data,error}=await supabase.from('secret_attachments').insert({id,secret_id:s.id,
    file_name:req.file.originalname.slice(0,255),mime_type:'application/octet-stream',file_size:req.file.size,
    storage_path:path,encrypted_key_bundle:req.body.encryptedKeyBundle}).select('id,file_name,mime_type,file_size,created_at').single();
  if(error) {await supabase.storage.from('secure-attachments').remove([path]);throw new HttpError(503,'DATABASE_UNAVAILABLE');}
  check(await supabase.from('access_events').insert({secret_id:s.id,event_type:'ATTACHMENT_UPLOADED'}));
  res.status(201).json({success:true,attachment:{id:data.id,fileName:data.file_name,mimeType:data.mime_type,fileSize:data.file_size,createdAt:data.created_at}});
});

export async function delivery(req:any) {
  const s=await secretRecord(req.params.id);
  try {
  const bearer=req.get('authorization');
  if(!bearer?.startsWith('Bearer ')) throw new HttpError(401,'ACCESS_TOKEN_REQUIRED');
  const raw=bearer.slice(7);
  if(raw.length>512) throw new HttpError(401,'INVALID_ACCESS_TOKEN');
  const {data,error}=await supabase.from('secret_access_tokens').select('expires_at,delivery_grant')
    .eq('secret_id',s.id).eq('token',digest(raw)).maybeSingle();
  if(error) throw new HttpError(503,'DATABASE_UNAVAILABLE');
  if(!data||Date.parse(data.expires_at)<=Date.now()) throw new HttpError(401,'INVALID_ACCESS_TOKEN');
  if(!check(await supabase.rpc('take_rate_limit',{p_key:'delivery:'+digest(raw),p_limit:120,p_seconds:60})))throw new HttpError(429,'RATE_LIMITED');
  if(s.status==='revoked'||s.is_suspended||Date.parse(s.expires_at)<=Date.now()) throw new HttpError(410,'ACCESS_REVOKED');
  if(!data.delivery_grant) available(s);
  return s;
  }catch(error){if(error instanceof HttpError&&[401,403,410,429].includes(error.status))await observe(req,s.id,'ATTACHMENT_REJECTED');throw error}
}
router.get('/:id/attachments',async(req,res)=>{
  const s=await delivery(req);
  const items=check(await supabase.from('secret_attachments').select('id,file_name,mime_type,file_size,created_at,encrypted_key_bundle')
    .eq('secret_id',s.id).order('created_at'));
  res.json({success:true,attachments:(items??[]).map(a=>({id:a.id,fileName:a.file_name,mimeType:a.mime_type,fileSize:a.file_size,
    createdAt:a.created_at,encryptedKeyBundle:a.encrypted_key_bundle}))});
});
router.get('/:id/attachments/:attachmentId/download',async(req,res)=>{
  const s=await delivery(req);
  if(!uuid(req.params.attachmentId)) throw new HttpError(404,'NOT_FOUND');
  const a=check(await supabase.from('secret_attachments').select('storage_path').eq('secret_id',s.id).eq('id',req.params.attachmentId).maybeSingle());
  if(!a) throw new HttpError(404,'NOT_FOUND');
  const blob=check(await supabase.storage.from('secure-attachments').download(a.storage_path));
  if(!blob) throw new HttpError(503,'STORAGE_UNAVAILABLE');
  check(await supabase.from('access_events').insert({secret_id:s.id,event_type:'ATTACHMENT_DOWNLOADED'}));
  res.type('application/octet-stream').send(Buffer.from(await blob.arrayBuffer()));
});
export default router;
